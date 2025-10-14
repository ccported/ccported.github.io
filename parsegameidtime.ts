import * as fsp from 'fs/promises';
import * as fs from 'fs';
import { exec, execSync } from 'child_process';
import { timeStamp } from 'console';

async function main () {
    const file = "gameidtime.txt";

    const content = await fsp.readFile(file, { encoding: "utf8" });
    const rows = content.split("\n");
    const games = rows.map(g => {
        g = g.trim();
        const sections = g.split(" ");
        const [gameName, gameID, ...gameTime] = sections;
        let gameDate = new Date(gameTime.join(" "));
        if (isNaN(gameDate.getTime())){
            gameDate = new Date("March 9, 2025")
        }
        return {
            gameName,
               gameID,
            gameDate
        }
    });

    let workingGames = games.filter(g => !isNaN(g.gameDate.getTime())).sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime());


    const command = (gameID: string, timestamp: number) => {
        fs.writeFileSync("values.json", JSON.stringify({ ":u": { "N": `${timestamp}` } }))
        fs.writeFileSync("key.json", JSON.stringify({ "gameID": { "S": gameID } }));
        return `aws dynamodb update-item
        --table-name games_list
        --key file://key.json
        --update-expression "SET uploadedTimestamp = :u, updatedTimestamp = :u"
        --expression-attribute-values file://values.json`
    }

    let lastTime = 0;
    let inc = 0;
    workingGames.forEach(game => {
        let add = lastTime == game.gameDate.getTime() ? ++inc : (inc = 0);
        lastTime = game.gameDate.getTime();
        let c = command(game.gameID, game.gameDate.getTime() + add);
        console.log(">>>>", c);
        execSync(c.split("\n").map(s => s.trim()).join(" "));
        console.log("Finished", game.gameName)
    })
}

main().then(() => {
    console.log("\n\nDone")
}).catch(console.error)