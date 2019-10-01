import {Logger} from './logger';
import Discord from 'discord.js';

const MOD: string = "serverUtils.ts";

export default class ServerUtils {
    private static logger: Logger = new Logger();
    private static guild: Discord.Guild;

    static addRoleToUser(memb: Discord.GuildMember, role: Discord.Role, errCallback?: () => void): void {
        memb.addRole(role)
            .catch(err => {
                this.logger.error(`Failed to add ${role.name} role to ${memb}. Error: ${err}`, MOD);

                if (errCallback) errCallback();
            });
    }

    static setUserRoles(memb: Discord.GuildMember, roles: Discord.Role[], reason: string): Promise<Discord.GuildMember> {
        return memb.setRoles(roles, reason);
    }

    static removeRole(memb: Discord.GuildMember, role: Discord.Role, reason: string): void {
        memb.removeRole(role, reason);
    }

    static messageChannel(channel: Discord.TextChannel, message: string) {
        channel.send(message)
            .catch(err => {
                this.logger.warn(`Couldn't send message to ${channel.name}. Error: ${err}`, MOD);
            });
    }

    static directMessage(memb: Discord.GuildMember, message: string) {
        memb.createDM()
            .then(chan => {
                chan.send(`${message}\n\nI am a bot, and this action was performed automatically. DM replies are not monitored.`);
            })
            .catch(err => {
                this.logger.warn(`Couldn't DM ${memb}. Error: ${err}`, MOD);
            });
    }

    static deleteMessage(msg: Discord.Message, callback: Function) {
        msg.delete()
            .then(() => {
                if (callback) callback();
            })
            .catch((err) => {
                this.logger.warn(`Failed to delete message. Error: ${err}`, MOD);
            });
    }

    static getMembers(): Discord.Collection<string, Discord.GuildMember> {
        return this.guild.members;
    }

    static getMemberForUser(user: Discord.User): Discord.GuildMember {
        return this.guild.member(user);
    }

    static setGuild(_guild: Discord.Guild): void {
        this.guild = _guild;
    }
};