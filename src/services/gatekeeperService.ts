import Discord from "discord.js";

import { singleton } from "tsyringe";
import { Logger } from "../utilities/logger";
import { CommandType } from "../handlers/commandHandler";
import Guard from "../utilities/guard";
import ServerUtils from "../utilities/serverUtils";

const MOD = "gatekeeperService.ts";

@singleton()
export class GatekeeperService {
    private famRole: Discord.Role;
    private rulesChannel: Discord.TextChannel;
    private botLogChannel: Discord.TextChannel;
    private reactMessage: Discord.Message;

    constructor(private logger: Logger) {}

    startup(registerCallback: (
        trigger: string, 
        action: (
            msg: Discord.Message, 
            args?: string[]
        ) => void, 
        commandType: CommandType, 
        preReq?: (
            msg: Discord.Message
        ) => boolean
    ) => void): void {
        this.logger.info("Registered no commands.", MOD);
    }

    setup(_famRole: Discord.Role, _rulesChannel: Discord.GuildChannel, _botLogChannel: Discord.GuildChannel): void {
        this.famRole = _famRole;
        this.rulesChannel = <Discord.TextChannel>_rulesChannel;
        this.botLogChannel = <Discord.TextChannel>_botLogChannel;

        if (!this.famRole) this.logger.warn("Couldn't find a Fam role.", MOD);
        if (!this.botLogChannel) this.logger.warn("Couldn't find a bot log channel.", MOD);
        if (!this.rulesChannel) this.logger.warn("Couldn't find a rules channel.", MOD);
        else {
            this.rulesChannel.fetchMessages({limit: 3}).then((msgs) => {
                this.reactMessage = msgs.first();

                if (!this.reactMessage) this.logger.warn("Couldn't find a react message!", MOD);
            });
        }
    }

    checkReaction(react: Discord.MessageReaction, user: Discord.User): void {
        if (react.emoji.name !== '👍') return;
        if (react.message.id !== this.reactMessage.id) return;

        var memb = ServerUtils.getMemberForUser(user);

        if (!memb) {
            this.logger.warn(`Failed to get member for ${user}!`, MOD);
            ServerUtils.messageChannel(this.botLogChannel, `${user} gave the rules a thumbs-up, but I couldn't give them the Swamp Fam role. Please give it to them manually.`);
            return;
        }

        ServerUtils.addRoleToUser(memb, this.famRole, () => {
            ServerUtils.messageChannel(this.botLogChannel, `${memb} gave the rules a thumbs-up, but I couldn't give them the Swamp Fam role. Please give it to them manually.`);
        });
    }
}