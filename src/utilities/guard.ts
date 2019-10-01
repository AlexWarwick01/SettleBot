import * as Discord from "discord.js";

export default class Guard {
    private static devMode: boolean = true;
    private static guild: Discord.Guild;

    static isMod(msg: Discord.Message): boolean {
        var memb = this.guild.member(msg.author);

        return (memb && memb.hasPermission(Discord.Permissions.FLAGS.KICK_MEMBERS));
    }

    static isSeniorMod(msg: Discord.Message): boolean {
        var memb = this.guild.member(msg.author);

        return (memb && memb.hasPermission(Discord.Permissions.FLAGS.MANAGE_MESSAGES));
    }

    static isAdmin(msg: Discord.Message): boolean {
        var memb = this.guild.member(msg.author);

        return (memb && memb.hasPermission(Discord.Permissions.FLAGS.ADMINISTRATOR));
    }

    static isBotOwner(msg: Discord.Message): boolean {
        return (msg.author.username === "Hoffi Coffi" && msg.author.tag === "HoffiCoffi#0073");
    }

    static isToucann(msg: Discord.Message): boolean {
        return (msg.author.username === "Toucann" && msg.author.tag === "Toucann#6889");
    }

    static isDevMode(): boolean {
        return this.devMode;
    }

    static setDevMode(_devMode: boolean): void {
        this.devMode = _devMode;
    }

    static setGuild(_guild: Discord.Guild): void {
        this.guild = _guild;
    }
};