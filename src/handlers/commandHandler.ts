import { singleton } from 'tsyringe';
import * as Discord from "discord.js";

import { MetricService } from '../services/metricService';
import { AdminService } from '../services/adminService';
import { MemberService } from '../services/memberService';
import { FilterService } from '../services/filterService';
import { CmlService } from '../services/cmlService';
import { ConfigService } from '../services/configService';
import { HelpService } from '../services/helpService';
import { StatsService } from '../services/statsService';
import { GatekeeperService } from '../services/gatekeeperService';

import { Logger } from '../utilities/logger';
import Guard from '../utilities/guard';
import ServerUtils from '../utilities/serverUtils';

const MOD = "commandHandler.ts";

export enum CommandType {
    Public, Private, All
};

interface ICommandDefinition {
    trigger: string,
    action: (msg?: Discord.Message, args?: string[]) => string | void,
    preReq?: (msg: Discord.Message) => boolean
    type: CommandType
};

@singleton()
export class CommandHandler {
    private commandDefinitions: ICommandDefinition[] = [];

    constructor(private metricService: MetricService, 
        private adminService: AdminService, 
        private memberService: MemberService, 
        private filterService: FilterService,
        private cmlService: CmlService, 
        private configService: ConfigService, 
        private helpService: HelpService,
        private statsService: StatsService,
        private gatekeeperService: GatekeeperService,
        private logger: Logger) {}

    private registerCommand(
        trigger: string, 
        action: (msg?: Discord.Message, args?: string[]) => string | void, 
        commandType: CommandType,
        preReq?: (msg: Discord.Message) => boolean): void {
        var existingCommand = this.commandDefinitions.find((cmd) => cmd.trigger === trigger);

        if (existingCommand) {
            this.logger.error(`Attempted to register a command for trigger "${trigger}" but one already exists!`, MOD);
            return;
        }

        this.commandDefinitions.push({
            trigger: trigger,
            action: action,
            preReq: preReq,
            type: commandType
        });
    }

    startup(): void {
        this.metricService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.adminService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.memberService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.filterService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.cmlService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.configService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.helpService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.statsService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));
        this.gatekeeperService.startup((trigger, action, commandType, preReq) => this.registerCommand(trigger, action, commandType, preReq));

        this.logger.info(`Command registration complete. Total commands: ${this.commandDefinitions.length}`, MOD);
    }

    setup(bot: Discord.Client): void {
        var server = bot.guilds.first();

        Guard.setGuild(server);
        ServerUtils.setGuild(server);

        this.adminService.setup(() => {
            this.logger.info("Destroying bot...", MOD);
            bot.destroy().then(() => {
                process.exit();
            })
            .catch((err) => {
                this.logger.error(`Failed to destroy bot: ${err}`);
                process.exit(1);
            });
        }, 
        server.channels.find((channel) => channel.name === 'bot-log'),
        server.roles.find((role) => role.name === "Muted"));

        var sotwChannel = server.channels.find((chan) => chan.name === "settlement_athletes");
        this.memberService.setup(server.roles.find((role) => role.name === 'Athlete'));
        this.configService.setup(sotwChannel);
        this.helpService.setup(server.channels.find((chan) => chan.name === "rules"), sotwChannel);
        this.gatekeeperService.setup(server.roles.find((role) => role.name === "Swamp Fam"), 
            server.channels.find((chan) => chan.name === "rules"),
            server.channels.find((chan) => chan.name === "bot-log"));
    }

    trigger(trigger: string, msg: Discord.Message, args: string[], commandType: CommandType): boolean {
        var cmdType = "Public";
        if (commandType === CommandType.Private) cmdType = "Private";
        else if (commandType === CommandType.All) cmdType = "All";

        this.logger.info(`Attempting to find handler for ${cmdType} command "${trigger}"...`, MOD);
        var foundCommand = this.commandDefinitions.find((cmd) => cmd.trigger === trigger && (cmd.type === CommandType.All || cmd.type === commandType));

        if (!foundCommand) {
            this.logger.info("Command not found.", MOD);
            return false;
        }

        this.logger.info("Command found! Executing...", MOD);

        var preReqPassed = (!foundCommand.preReq);
        if (!preReqPassed) preReqPassed = foundCommand.preReq(msg);

        if (preReqPassed) {
            var result = foundCommand.action(msg, args);

            if (result) msg.reply(result);
        }

        return true;
    }
};