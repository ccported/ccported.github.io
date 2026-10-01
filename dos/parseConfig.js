export function parseConfig(config) {
    const lines = config.split("\n");
    const parsedConfig = {};
    let lastSection = parsedConfig;
    for (const line of lines) {
        // comments:
        if (line.startsWith("#") || line.startsWith(";")) {
            continue;
        }
        // determiners:
        if (line.startsWith("[")) {
            const section = line.slice(1, -1);
            parsedConfig[section] = {};
            lastSection = parsedConfig[section];
            continue;
        }
        const [key, value] = line.split("=");
        if (key && value) {
            lastSection[key.trim()] = value.trim();
        }
        if(key && !value) {
            lastSection[key.trim()] = null;
        }
    }
    return parsedConfig;
}

export function unparseConfig(config) {
    let result = "";
    for (const section in config) {
        result += `[${section}]\n`;
        for (const key in config[section]) {
            result += `${key}=${config[section][key]}\n`;
        }
    }
    return result;
}

// function renderConfig(configDes) {
//     const div = document.getElementById("dosEmConf");
//     const feildsets = Object.keys(configDes);
//     feildsets.forEach((feild) => {
//         if(feild === "autoexec"){
//             return;
//         }
//         const el = document.createElement("fieldset");
//         const legend = document.createElement("legend");
//         legend.innerText = feild;
//         el.appendChild(legend);
//         const description = configDes[feild].description;
//         const validOptions = configDes[feild].options;
//         console.log(configDes[feild]);
//         const p = document.createElement("p");
//         p.innerText = description;
//         el.appendChild(p);
//         if(feild === "layers") return;
//         Object.keys(validOptions).forEach((option)=>{
//             const group = document.createElement("div");
//             const label = document.createElement("label");
//             label.innerText = option;
//             const allowedValues = validOptions[option].allowedValues;
//             const optionDesc = validOptions[option].description;
//             const currentValue = validOptions[option].value;

//             const inputType = (allowedValues && allowedValues.length > 0) ? "select" : "input";

//             const desc = document.createElement("p");
//             desc.innerText = optionDesc;

//             const input = document.createElement(inputType);
//             input.name = option;
//             input.value = currentValue;
//             if(inputType === "select"){
//                 allowedValues.forEach((value)=>{
//                     const option = document.createElement("option");
//                     option.value = value;
//                     option.innerText = value;
//                     input.appendChild(option);
//                 });
//             }

//             group.appendChild(label);
//             group.appendChild(input);
//             group.appendChild(desc);
//             el.appendChild(group);
//             const separator = document.createElement("hr");
//             el.appendChild(separator);

//         });
//         const saveButton = document.createElement("button");
//         saveButton.innerText = "Save";
//         saveButton.onclick = updateConfig;
//         el.appendChild(saveButton);
//         div.appendChild(el);
//     });

    
// }
// function updateConfig() {
//     const feilds = document.querySelectorAll("#dosEmConf fieldset");
//     const jsdosConf = {};
//     feilds.forEach((feild)=>{
//         const feildName = feild.querySelector("legend").innerText;
//         const inputs = feild.querySelectorAll("input, select");
//         jsdosConf[feildName] = {};
//         inputs.forEach((input)=>{
//             const name = input.name;
//             const value = input.value;
//             jsdosConf[feildName][name] = value;
//         });
//     });
//     const dosconf = unparseConfig(jsdosConf);
//     console.log(dosconf);
// }