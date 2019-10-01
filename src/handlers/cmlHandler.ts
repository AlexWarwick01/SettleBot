import { singleton } from "tsyringe";
import * as cheerio from "cheerio";
import moment from "moment";
import * as https from "https";
import * as FormData from "form-data";

import { Logger } from "../utilities/logger";
import Formatter from "../utilities/formatter";

import { ConfigHandler } from "../handlers/configHandler";
import TableBuilder, { Table } from "../utilities/tableBuilder";

const MOD = "cmlHandler.ts";

const baseURL = "https://crystalmathlabs.com/tracker";

const siteBaseURL = `${baseURL}/competitions.php?competition=`;
const updateURL = `${baseURL}/update.php?player=`;
const groupURL = `${baseURL}/virtualhiscores.php?page=statistics&competition=`;
const createURL = `${baseURL}/compcreate.php`;
const groupEditURL = `${baseURL}/groupedit.php?group=`;
const statsURL = `${baseURL}/view_stats.php?time=all&player=`;

@singleton()
export class CmlHandler {
    private playerList = undefined;
    private queuedData = [];

    constructor(private logger: Logger, private configHandler: ConfigHandler) {}

    getGroup(callback: (group: string, cmlErr?: string) => void): void {
        var compId = this.configHandler.getSetting("sotwCompId");

        var url = groupURL + compId;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var $ = cheerio.load(data);

                var links = $('#content').children('a');

                var group = links.first().attr('href').split('=')[1];

                if (group && callback) callback(group);
            });
        });
    }

    getUserList(group: string, callback: (playerList: string, cmlErr?: string) => void): void {
        var url = `${createURL}?group=${group}`;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var $ = cheerio.load(data);

                var textCheck = $('#content').text();
                if (textCheck.indexOf("You must wait") > -1) {
                    callback(null, textCheck.split("According")[0]);
                    return;
                }

                var textArea = $("textarea[name='players']");

                this.playerList = textArea.val();

                if (this.playerList && callback) callback(this.playerList);
            });
        });
    }

    stageData(skill: string, callback: Function): void {
        this.queuedData = [];

        var compNumber = parseInt(this.configHandler.getSetting("sotwCompNum")) + 1;

        this.queuedData.push({
            name: "title",
            value: "Settlement SOTW #" + compNumber
        });

        var now = new Date();
        now.setMinutes(Math.ceil(now.getUTCMinutes() / 30) * 30);
        var day = now.getUTCDate().toString();
        if (now.getUTCDate() < 10) day = "0" + day;

        this.queuedData.push({
            name: "start_date",
            value: `${now.getUTCFullYear()}-${Formatter.mapMonth(now.getUTCMonth()+1)}-${day}`
        });

        var time = Formatter.convertTime(`${now.getUTCHours()}:${now.getUTCMinutes()}`, null, false);
        this.queuedData.push({
            name: "start_time",
            value: time
        });

        var end = new Date(now);
        end.setDate(end.getUTCDate() + 7);
        day = end.getUTCDate().toString();
        if (end.getUTCDate() < 10) day = "0" + day;

        this.queuedData.push({
            name: "end_date",
            value: `${end.getUTCFullYear()}-${Formatter.mapMonth(end.getUTCMonth()+1)}-${day}`
        });

        this.queuedData.push({
            name: "end_time",
            value: time
        });

        this.queuedData.push({
            name: "players",
            value: this.playerList
        });

        this.queuedData.push({
            name: "stat",
            value: skill
        });

        this.queuedData.push({
            name: "password",
            value: "yo"
        });

        if (callback) callback(this.queuedData);
    }

    abandonComp(callback: Function): void {
        if (!this.playerList && this.queuedData.length < 1) {
            callback("no competition is currently pending.");
            return;
        }
    
        this.playerList = undefined;
        this.queuedData = [];
    
        callback("done!");
    }

    createNewComp(callback: Function): void {
        if (!this.playerList || this.queuedData.length < 1) return; //todo handle better

        var form = new FormData();

        this.logger.info("Attempting creation of new SOTW with data:");

        this.queuedData.forEach((val) => {
            var value = val.value;
            form.append(val.name, value);

            if (val.name === "players") value = value.split("\n").length + " players";

            this.logger.info(`Name: ${val.name} | Value: ${value}`);
        });

        var url = `${createURL}`;
        form.submit(url, (err, res) => {
            if (err) console.log(err);
            else {
                var loc = res.headers.location;

                var newCompId = loc.split('=')[1];

                if (newCompId && callback) callback(newCompId, this.queuedData);
            }
            res.resume();
        });
    }

    addPlayer(player: string, group: string, callback: Function): void {
        var compId = this.configHandler.getSetting("sotwCompId");

        var form = new FormData();

        form.append("mode", "add");
        form.append("group", group);
        form.append("refer", siteBaseURL + compId);
        form.append("player", player);
        form.append("password", "yo");

        var url = groupEditURL + group;
        form.submit(url, (err) => {
            if (err) this.logger.error(`Failed to add "${player}" to CML. Reason: ${err}`, MOD);
            else if (callback) callback();
        });
    }

    getStatsData(rsn: string, callback: (data: string) => any): void {
        var url = statsURL + rsn;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var $ = cheerio.load(data);

                var table = $('#stats_table > tbody');

                var callbackData = '';

                var rows = table.children('tr');

                rows.each((i, elem) => {
                    if (i === 0 || i === rows.length - 1) return;
                    var row = $(elem);
                    var rowToAdd = "";
                    var ignoreRow = false;

                    row.children('td').each((i2, elem2) => {
                        if (i2 === 4) return;

                        var cell = $(elem2);
                        if (!ignoreRow && cell.text().indexOf("EHP") > -1) ignoreRow = true;
                        
                        rowToAdd += cell.text().trim().split(',').join('');

                        if (i2 !== 3) rowToAdd += ",";
                    });

                    if (!ignoreRow) callbackData += rowToAdd + "\n";
                });

                callback(callbackData);
            });
        });
    }

    getData(callback: (data: string) => any): void {
        var compId = this.configHandler.getSetting("sotwCompId");

        var url = siteBaseURL + compId + "&count=200";

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var $ = cheerio.load(data);

                var table = $('#competition_table > tbody');

                var callbackData = '';

                var rows = table.children('tr');

                rows.each((i, elem) => {
                    if (i === 0 || i === rows.length - 1) return;
                    var row = $(elem);

                    row.children('td').each((i2, elem2) => {
                        if (i2 === 4) return;

                        var cell = $(elem2);
                        if (i2 === 0) {
                            callbackData += cell.children('a').first().html().trim().split('&#xA0;').join('_') + ',';
                        } else {
                            callbackData += cell.text().trim().replace('+', '').split(',').join('');

                            if (i2 !== 3) callbackData += ",";
                        }
                    });

                    callbackData += "\n";
                });

                callback(callbackData);
            });

            res.on('error', (err) => {
                this.logger.error(`Failed to get SOTW data: ${err}`, MOD);
            });
        });
    }

    updatePlayer(player: string, callback?: (content: string) => void): void {
        var url = updateURL + player;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () =>  {
                if (callback) {
                    var $ = cheerio.load(data);

                    var content = $('#content').text();

                    callback(content);
                }
            });
        });
    }

    scrape(callback: Function, overrideCompId?: string) {
        var compId = overrideCompId;

        if (!compId) compId = this.configHandler.getSetting("sotwCompId");

        var url = siteBaseURL + compId;

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var $ = cheerio.load(data);

                var sidebar = $('#sidebar > ul > li');

                var skill = "";
                var start;
                var end;

                sidebar.each((i, elem) => {
                    //so hacky but I blame CML for making me do this
                    switch (i) {
                        case 0:
                            skill = $(elem).text().trim();
                            break;
                        case 3:
                            start = Formatter.momentifyDate($(elem).text().replace("Started", "").replace(/ *\([^)]*\) */g, "").trim());
                            break;
                        case 4:
                            end = Formatter.momentifyDate($(elem).text().replace("Ended", "").replace("Ends", "").replace(/ *\([^)]*\) */g, "").trim());
                            break;
                    }
                });

                var settings = [];

                settings.push({
                    name: "sotwSkill",
                    value: skill
                });

                settings.push({
                    name: "sotwStart",
                    value: start
                });

                settings.push({
                    name: "sotwEnd",
                    value: end
                });

                this.configHandler.updateMultipleSettings(settings, callback);
            });
        });
    }

    sotwlink(): string {
        return siteBaseURL + this.configHandler.getSetting("sotwCompId");
    }

    sotw(callback: (msg: string) => void, limitTop: number = 5, search?: string) {
        this.getData((data) => {
            var sotwEnd = moment(this.configHandler.getSetting("sotwEnd"));
            var endWord = (sotwEnd.isBefore(moment())) ? "Ended" : "Ends";
            var tableHeader = [
                `Skill: ${this.configHandler.getSetting("sotwSkill")}`,
                `Started: ${moment(this.configHandler.getSetting("sotwStart")).format("Do MMM YYYY, h:mmA")} GMT`,
                `${endWord}: ${sotwEnd.format("Do MMM YYYY, h:mmA")} GMT`
            ];

            if (sotwEnd.isAfter(moment())) tableHeader.push(`Ends ${sotwEnd.fromNow()}`);

            var lines = data.split('\n');
            var cells: string[][] = [];
            lines.forEach((line, idx) => {
                if (idx + 1 > limitTop) return;
                if (line.length > 1) {
                    var newRow = [(idx + 1).toString()];
                    var row = line.split(',');
                    newRow.push(Formatter.formatRSN(row[0].trim()));
                    newRow.push(parseInt(row[1]).toLocaleString());
                    newRow.push(parseInt(row[2]).toLocaleString());
                    newRow.push(parseInt(row[3]).toLocaleString());

                    cells.push(newRow);
                }
            });

            var reduce = 0;
            if (search) {
                var found = lines.find((obj) => {
                    var line = obj.split(',');
                    return line && line.length > 0 && line[0].toLowerCase().trim() === search.toLowerCase().trim();
                });

                var formattedSearch = Formatter.formatRSN(search.toLowerCase().trim());
                if (found && !cells.find((obj) => {
                    return Formatter.formatRSN(obj[1].toLowerCase().trim()).toLowerCase().trim() === formattedSearch.toLowerCase().trim();
                })) {
                    reduce++;
                    cells.push(["..", "..", "..", "..", ".."]);
                    var newRow = [(lines.indexOf(found) + 1).toString()];
                    var row = found.split(',');
                    newRow.push(Formatter.formatRSN(row[0].trim()));
                    newRow.push(parseInt(row[1]).toLocaleString());
                    newRow.push(parseInt(row[2]).toLocaleString());
                    newRow.push(parseInt(row[3]).toLocaleString());

                    cells.push(newRow);
                }
            }

            var foot = undefined;
            if (lines.length > limitTop) {
                foot = [`...plus ${lines.length - limitTop - reduce} more...`];
            }

            var table: Table = {
                header: tableHeader,
                columns: ["Pos.", "RSN", "Start", "End", "Gain"],
                rows: cells,
                footer: foot
            };

            var result = TableBuilder.build(table);
    
            callback("```" + result + "```");
        });
    }
};