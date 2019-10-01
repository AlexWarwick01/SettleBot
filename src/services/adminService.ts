import { singleton } from "tsyringe";
import * as Discord from "discord.js";

import { Logger } from "../utilities/logger";
import Guard from "../utilities/guard";
import ServerUtils from "../utilities/serverUtils";

import { MetricHandler, Metric } from "../handlers/metricHandler";
import { MemberHandler } from "../handlers/memberHandler";
import { CommandType } from "../handlers/commandHandler";

const MOD = "adminService.ts";

@singleton()
export class AdminService {
    private destroyFunc: Function;
    private auditChannel: Discord.TextChannel;
    private muteRole: Discord.Role;

    constructor(private metricHandler: MetricHandler, private memberHandler: MemberHandler, private logger: Logger) {}

    startup(registerCallback: (trigger: string, action: (msg: Discord.Message, args?: string[]) => void, commandType: CommandType, preReq?: (msg: Discord.Message) => boolean) => void): void {
        registerCallback("logout", (msg) => this.logout(msg), CommandType.Private, (msg) => Guard.isSeniorMod(msg));
        registerCallback("unmute", (msg) => this.unmuteMember(msg), CommandType.Public, (msg) => Guard.isSeniorMod(msg));
        registerCallback("mute", (msg) => this.muteMember(msg), CommandType.Public, (msg) => Guard.isMod(msg));

        this.logger.info("Registered 3 commands.", MOD);
    }

    setup(_destroyFunc: Function, _auditChannel: Discord.GuildChannel, _muteRole: Discord.Role) {
        this.destroyFunc = _destroyFunc;
        this.auditChannel = <Discord.TextChannel>_auditChannel;
        this.muteRole = _muteRole;

        if (!this.muteRole) this.logger.warn("Couldn't find a Mute role. Members won't be automatically or manually muted.", MOD);
        if (!this.auditChannel) this.logger.warn("Couldn't find an audit channel. Notifications won't be posted.", MOD);
    }

    getMuteRole(): Discord.Role {
        return this.muteRole;
    }

    getAuditChannel(): Discord.TextChannel {
        return this.auditChannel;
    }

    logout(msg: Discord.Message): void {
        this.logger.info(`Initiating bot shutdown on behalf of ${msg.author.username}...`, MOD);
    
        // if (!Guard.isDevMode()) ServerUtils.messageChannel(this.auditChannel, `Shutting down by request of ${msg.guild.member(msg.author)} :cry:`);

        this.metricHandler.shutdown(() => this.memberHandler.shutdown(() => this.destroyFunc()));
    }

    muteMember(msg: Discord.Message): void {
        var memb = msg.guild.member(msg.author);

        var mention = msg.mentions.users.first();

        if (!mention) {
            msg.reply("you have to tag a user to mute.");
            return;
        }

        var mentionMemb = msg.guild.member(mention);

        if (memb.highestRole.comparePositionTo(mentionMemb.highestRole) <= 0) {
            msg.reply("you can only mute roles below yours.");
            return;
        }

        ServerUtils.setUserRoles(mentionMemb, [this.muteRole], `Mute requested by ${msg.author.username}.`)
            .then(() => {
                this.metricHandler.increment(Metric.MembersMutedManual);
                ServerUtils.messageChannel(this.auditChannel, `${memb} has just muted ${mentionMemb}`);
                ServerUtils.directMessage(mentionMemb, `Hi ${mentionMemb}, you were muted in the Settlement Discord server. To be unmuted, please DM a Settlement Defender or Admin.`)
            });
    }

    unmuteMember(msg: Discord.Message): void {
        var mention = msg.mentions.users.first();

        if (!mention) {
            msg.reply("you have to tag a user to unmute.");
            return;
        }

        var mentionMemb = msg.guild.member(mention);

        if (!mentionMemb.roles.some(role => role.name === this.muteRole.name)) {
            msg.reply("I can't unmute someone who isn't muted.");
            return;
        }

        ServerUtils.removeRole(mentionMemb, this.muteRole, `Unmuted on behalf of ${msg.author.username}.`);
    }
};