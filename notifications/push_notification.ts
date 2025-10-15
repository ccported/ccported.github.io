const notificationJSONFilePath = process.argv[2] || "notification.json";


import * as fsp from 'fs/promises';
import * as fs from 'fs';
import { exec, execSync } from 'child_process';


async function main () {
    const file = notificationJSONFilePath;

    const content = await fsp.readFile(file, { encoding: "utf8" });
    const notification = JSON.parse(content);


    const { 
        title, body, expires, cta
    } = notification;

    const id = uuid();


    const command = (id: string, title: string, body: string, expires: number, cta: any): string => {
        const ctaText = typeof cta === 'object' && cta.text ? cta.text : (typeof cta === 'string' ? cta : '');
        const ctaLink = typeof cta === 'object' && cta.url ? cta.url : '';
        
        fs.writeFileSync("values.json", JSON.stringify({ 
            notification_id: { "S": id },
            title: { "S": title },
            body: { "S": body },
            expires: { "N": `${expires}` },
            ctaText: { "S": ctaText },
            ctaLink: { "S": ctaLink }
        }))
        return `aws dynamodb put-item
        --table-name ccported_notifs
        --item file://values.json`
    }

    let c = command(id, title, body, expires, cta);
    console.log(">>>>", c);
    execSync(c.split("\n").map(s => s.trim()).join(" "));
    console.log("Finished", title);
}


function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

main().then(() => {
    console.log("\n\nDone")
}).catch(console.error)