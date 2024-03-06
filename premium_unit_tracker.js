module.exports = {
    defaultConfig: {
        enabled: true,
        export: false,
        premiumUnits: '',
        unitAmount: '',
    },
    defaultConfigDetails: {
        premiumUnits: { label: 'Premium units to track, separated by comma', type: 'textarea' },
        unitAmount: { label: 'Usage of premium units by each player', type: 'textarea' },
        export: { label: 'Export default structure for guild members for currently selected premium units' }
    },
    pluginName: "Premium offense unit tracker",
    pluginDescription: "Plugin to track your guilds premium offense units",
    init(proxy, config) {
        if (config.Config.Plugins[this.pluginName].enabled) {
            sendProxyMessage(proxy, "Tracking the following premium units: " + config.Config.Plugins[this.pluginName].premiumUnits);
        }
        proxy.on("GetGuildSiegeBattleLog", (req, resp) => {
            try {
                if (config.Config.Plugins[this.pluginName].enabled && config.Config.Plugins[this.pluginName].premiumUnits != '') {
                    let trimmed_premium_units = config.Config.Plugins[this.pluginName].premiumUnits.trim().replace(/ /g, '');
                    let premium_units_ids = setupPremiumUnitsToLookFor(trimmed_premium_units);
                    this.decodeData(proxy, resp, premium_units_ids, config.Config.Plugins[this.pluginName].unitAmount);
                }
            } catch (err) {
                sendProxyMessage(proxy, "Seems like there was an error, please contact the maintainer of this plugin. Error: " + err);
            }
        });

        //used for building a default member mapping
        proxy.on("GetGuildInfo", (req, resp) => {
            try {
                if (config.Config.Plugins[this.pluginName].enabled && config.Config.Plugins[this.pluginName].export) {
                    let trimmed_premium_units = config.Config.Plugins[this.pluginName].premiumUnits.trim().replace(/ /g, '');
                    exportMemberList(proxy, resp, trimmed_premium_units);
                }
            } catch (err) {
                sendProxyMessage(proxy, "Seems like there was an error, please contact the maintainer of this plugin. Error: " + err);
            }
        })

    },
    decodeData(proxy, siegeBattleLog, premium_units_ids, playerUnitsCount) {
        let battle_log_list = siegeBattleLog["log_list"][0]["battle_log_list"];

        let units_used = trackMonsterUsage(battle_log_list, monster, premium_units_ids);

        let accumulatedUnitUsages = accumulateUnitUsage(units_used);

        let htmlToDisplay = createPlayerUsageHTML(units_used, playerUnitsCount);
        if (htmlToDisplay != null) {
            sendProxyMessage(proxy, htmlToDisplay);
        }
        let htmlUsagesHTML = createTotalUsageHTML(accumulatedUnitUsages);
        sendProxyMessage(proxy, htmlUsagesHTML);
    },
};

function exportMemberList(proxy, data, premiumUnits) {
    let memberListData = data["guild"]["guild_members"];
    let memberList = Object.values(memberListData).map(player => player.wizard_name);

    let premiumUnitsArray = premiumUnits.split(',');

    let playerUnitsCount = {};

    memberList.forEach(player => {
        let monstersCount = {};
        premiumUnitsArray.forEach(monster => {
            monstersCount[monster] = 0;
        });
        playerUnitsCount[player] = monstersCount;
    });
    let htmlToDisplay = createDefaultMappingHTML(playerUnitsCount);
    sendProxyMessage(proxy, htmlToDisplay);
}

function createDefaultMappingHTML(defaultMapping) {
    let prettyJson = JSON.stringify(defaultMapping, null, 2);

    let htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Default mapping for player Units Count</title>
      <style>
          pre {
              white-space: pre-wrap;
              white-space: -moz-pre-wrap;
              white-space: -pre-wrap;
              white-space: -o-pre-wrap;
              word-wrap: break-word;
              background-color: #f4f4f4;
              padding: 10px;
              border-radius: 5px;
          }
      </style>
  </head>
  <body>
      <h2>Default mapping for player Units Count</h2>
      <pre id="jsonDisplay">${prettyJson}</pre>
  </body>
  </html>
      `;
    return htmlContent;
}

function createTotalUsageHTML(usageData) {
    let htmlContent = '<html><body><ul>';
    for (const unit in usageData) {
        htmlContent += `<li>${unit}: Used ${usageData[unit]} times</li>`;
    }
    htmlContent += '</ul></body></html>';
    return htmlContent;
}

function sendProxyMessage(proxy, message_to_send) {
    proxy.log({
        type: "info",
        source: "plugin",
        name: "Unit tracker",
        message: message_to_send,
    });
}

function createPlayerUsageHTML(usageData, playerUnitsCount) {
    if (playerUnitsCount === '') {
        return null;
    }
    let htmlContent = '<html><body><ul>';
    for (const player in playerUnitsCount) {
        htmlContent += `<li>${player}: <ul>`;
        for (const unit in playerUnitsCount[player]) {
            let usageCount = usageData[player] && usageData[player][unit] !== undefined ? usageData[player][unit] : 0;
            let totalAmount = playerUnitsCount[player][unit];
            htmlContent += `<li>${unit} (Used ${usageCount} times / ${totalAmount})</li>`;
        }
        htmlContent += '</ul></li>';
    }
    htmlContent += '</ul></body></html>';
    return htmlContent;
}

function accumulateUnitUsage(playerUsageData) {
    let accumulatedUsage = {};

    for (const player in playerUsageData) {
        const unitsUsed = playerUsageData[player];

        for (const unit in unitsUsed) {
            if (!accumulatedUsage[unit]) {
                accumulatedUsage[unit] = 0;
            }
            accumulatedUsage[unit] += unitsUsed[unit];
        }
    }
    return accumulatedUsage;
}

function setupPremiumUnitsToLookFor(trimmed_premium_units) {
    let premium_units = trimmed_premium_units.split(',');
    let premium_units_ids = [];
    for (const id in monster.names) {
        if (premium_units.includes(monster.names[id])) {
            premium_units_ids.push(id);
        }
    }
    return premium_units_ids;
}

function trackMonsterUsage(battleLogList, monster, monsterIDs) {
    let usageTracker = {};
    for (const fight of battleLogList) {
        const wizardName = fight.wizard_name;
        const monstersUsed = fight.view_battle_deck_info[0];
        for (const monsterID of monstersUsed) {
            if (monsterIDs.includes(monsterID.toString())) {
                if (!usageTracker[wizardName]) {
                    usageTracker[wizardName] = {};
                }
                const monsterName = monster.names[monsterID];
                if (!usageTracker[wizardName][monsterName]) {
                    usageTracker[wizardName][monsterName] = 0;
                }
                usageTracker[wizardName][monsterName]++;
            }
        }
    }
    return usageTracker;
}

const monster = {
    names: {
        101: 'Fairy',
        10111: 'Elucia',
        10112: 'Iselia',
        10113: 'Aeilene',
        10114: 'Neal',
        10115: 'Sorin',
        10131: 'Elucia',
        10132: 'Iselia',
        10133: 'Aeilene',
        10134: 'Neal',
        10135: 'Sorin',

        102: 'Imp',
        10211: 'Fynn',
        10212: 'Cogma',
        10213: 'Ralph',
        10214: 'Taru',
        10215: 'Garok',

        103: 'Pixie',
        10311: 'Kacey',
        10312: 'Tatu',
        10313: 'Shannon',
        10314: 'Cheryl',
        10315: 'Camaryn',
        10331: 'Kacey',
        10332: 'Tatu',
        10333: 'Shannon',
        10334: 'Cheryl',
        10335: 'Camaryn',

        104: 'Yeti',
        10411: 'Kunda',
        10412: 'Tantra',
        10413: 'Rakaja',
        10414: 'Arkajan',
        10415: 'Kumae',

        105: 'Harpy',
        10511: 'Ramira',
        10512: 'Lucasha',
        10513: 'Prilea',
        10514: 'Kabilla',
        10515: 'Hellea',

        106: 'Hellhound',
        10611: 'Tarq',
        10612: 'Sieq',
        10613: 'Gamir',
        10614: 'Shamar',
        10615: 'Shumar',

        107: 'Warbear',
        10711: 'Dagora',
        10712: 'Ursha',
        10713: 'Ramagos',
        10714: 'Lusha',
        10715: 'Gorgo',
        10731: 'Dagora',
        10732: 'Ursha',
        10733: 'Ramagos',
        10734: 'Lusha',
        10735: 'Gorgo',

        108: 'Elemental',
        10811: 'Daharenos',
        10812: 'Bremis',
        10813: 'Taharus',
        10814: 'Priz',
        10815: 'Camules',

        109: 'Garuda',
        10911: 'Konamiya',
        10912: 'Cahule',
        10913: 'Lindermen',
        10914: 'Teon',
        10915: 'Rizak',

        110: 'Inugami',
        11011: 'Icaru',
        11012: 'Raoq',
        11013: 'Ramahan',
        11014: 'Belladeon',
        11015: 'Kro',
        11031: 'Icaru',
        11032: 'Raoq',
        11033: 'Ramahan',
        11034: 'Belladeon',
        11035: 'Kro',

        111: 'Salamander',
        11111: 'Kaimann',
        11112: 'Krakdon',
        11113: 'Lukan',
        11114: 'Sharman',
        11115: 'Decamaron',

        112: 'Nine-tailed Fox',
        11211: 'Soha',
        11212: 'Shihwa',
        11213: 'Arang',
        11214: 'Chamie',
        11215: 'Kamiya',

        113: 'Serpent',
        11311: 'Shailoq',
        11312: 'Fao',
        11313: 'Ermeda',
        11314: 'Elpuria',
        11315: 'Mantura',

        114: 'Golem',
        11411: 'Kuhn',
        11412: 'Kugo',
        11413: 'Ragion',
        11414: 'Groggo',
        11415: 'Maggi',

        115: 'Griffon',
        11511: 'Kahn',
        11512: 'Spectra',
        11513: 'Bernard',
        11514: 'Shamann',
        11515: 'Varus',
        11531: 'Kahn',
        11532: 'Spectra',
        11533: 'Bernard',
        11534: 'Shamann',
        11535: 'Varus',

        116: 'Undine',
        11611: 'Mikene',
        11612: 'Atenai',
        11613: 'Delphoi',
        11614: 'Icasha',
        11615: 'Tilasha',

        117: 'Inferno',
        11711: 'Purian',
        11712: 'Tagaros',
        11713: 'Anduril',
        11714: 'Eludain',
        11715: 'Drogan',

        118: 'Sylph',
        11811: 'Tyron',
        11812: 'Baretta',
        11813: 'Shimitae',
        11814: 'Eredas',
        11815: 'Aschubel',

        119: 'Sylphid',
        11911: 'Lumirecia',
        11912: 'Fria',
        11913: 'Acasis',
        11914: 'Mihael',
        11915: 'Icares',

        120: 'High Elemental',
        12011: 'Ellena',
        12012: 'Kahli',
        12013: 'Moria',
        12014: 'Shren',
        12015: 'Jumaline',

        121: 'Harpu',
        12111: 'Sisroo',
        12112: 'Colleen',
        12113: 'Seal',
        12114: 'Sia',
        12115: 'Seren',

        122: 'Slime',
        12211: '',
        12212: '',
        12213: '',
        12214: '',
        12215: '',

        123: 'Forest Keeper',
        12311: '',
        12312: '',
        12313: '',
        12314: '',
        12315: '',

        124: 'Mushroom',
        12411: '',
        12412: '',
        12413: '',
        12414: '',
        12415: '',

        125: 'Maned Boar',
        12511: '',
        12512: '',
        12513: '',
        12514: '',
        12515: '',

        126: 'Monster Flower',
        12611: '',
        12612: '',
        12613: '',
        12614: '',
        12615: '',

        127: 'Ghost',
        12711: '',
        12712: '',
        12713: '',
        12714: '',
        12715: '',

        128: 'Low Elemental',
        12811: 'Tigresse',
        12812: 'Lamor',
        12813: 'Samour',
        12814: 'Varis',
        12815: 'Havana',

        129: 'Mimick',
        12911: '',
        12912: '',
        12913: '',
        12914: '',
        12915: '',

        130: 'Horned Frog',
        13011: '',
        13012: '',
        13013: '',
        13014: '',
        13015: '',

        131: 'Sandman',
        13111: '',
        13112: '',
        13113: '',
        13114: '',
        13115: '',

        132: 'Howl',
        13211: 'Lulu',
        13212: 'Lala',
        13213: 'Chichi',
        13214: 'Shushu',
        13215: 'Chacha',
        13231: 'Lulu and Friends',
        13232: 'Lala and Friends',
        13233: 'Chichi and Friends',
        13234: 'Shushu and Friends',
        13235: 'Chacha and Friends',

        133: 'Succubus',
        13311: 'Izaria',
        13312: 'Akia',
        13313: 'Selena',
        13314: 'Aria',
        13315: 'Isael',

        134: 'Joker',
        13411: 'Sian',
        13412: 'Jojo',
        13413: 'Lushen',
        13414: 'Figaro',
        13415: 'Liebli',

        135: 'Ninja',
        13511: 'Susano',
        13512: 'Garo',
        13513: 'Orochi',
        13514: 'Gin',
        13515: 'Han',

        136: 'Surprise Box',
        13611: '',
        13612: '',
        13613: '',
        13614: '',
        13615: '',

        137: 'Bearman',
        13711: 'Gruda',
        13712: 'Kungen',
        13713: 'Dagorr',
        13714: 'Ahman',
        13715: 'Haken',

        138: 'Valkyrja',
        13811: 'Camilla',
        13812: 'Vanessa',
        13813: 'Katarina',
        13814: 'Akroma',
        13815: 'Trinity',

        139: 'Pierret',
        13911: 'Julie',
        13912: 'Clara',
        13913: 'Sophia',
        13914: 'Eva',
        13915: 'Luna',

        140: 'Werewolf',
        14011: 'Vigor',
        14012: 'Garoche',
        14013: 'Shakan',
        14014: 'Eshir',
        14015: 'Jultan',
        14031: 'Vigor',
        14032: 'Garoche',
        14033: 'Shakan',
        14034: 'Eshir',
        14035: 'Jultan',

        141: 'Phantom Thief',
        14111: 'Luer',
        14112: 'Jean',
        14113: 'Julien',
        14114: 'Louis',
        14115: 'Guillaume',

        142: 'Angelmon',
        14211: 'Blue Angelmon',
        14212: 'Red Angelmon',
        14213: 'Gold Angelmon',
        14214: 'White Angelmon',
        14215: 'Dark Angelmon',

        144: 'Dragon',
        14411: 'Verad',
        14412: 'Zaiross',
        14413: 'Jamire',
        14414: 'Zerath',
        14415: 'Grogen',

        145: 'Phoenix',
        14511: 'Sigmarus',
        14512: 'Perna',
        14513: 'Teshar',
        14514: 'Eludia',
        14515: 'Jaara',

        146: 'Chimera',
        14611: 'Taor',
        14612: 'Rakan',
        14613: 'Lagmaron',
        14614: 'Shan',
        14615: 'Zeratu',

        147: 'Vampire',
        14711: 'Liesel',
        14712: 'Verdehile',
        14713: 'Argen',
        14714: 'Julianne',
        14715: 'Cadiz',

        148: 'Viking',
        14811: 'Huga',
        14812: 'Geoffrey',
        14813: 'Walter',
        14814: 'Jansson',
        14815: 'Janssen',

        149: 'Amazon',
        14911: 'Ellin',
        14912: 'Ceres',
        14913: 'Hina',
        14914: 'Lyn',
        14915: 'Mara',

        150: 'Martial Cat',
        15011: 'Mina',
        15012: 'Mei',
        15013: 'Naomi',
        15014: 'Xiao Ling',
        15015: 'Miho',
        15031: 'Mina',
        15032: 'Mei',
        15033: 'Naomi',
        15034: 'Xiao Ling',
        15035: 'Miho',

        152: 'Vagabond',
        15211: 'Allen',
        15212: "Kai'en",
        15213: 'Roid',
        15214: 'Darion',
        15215: 'Jubelle',

        153: 'Epikion Priest',
        15311: 'Rina',
        15312: 'Chloe',
        15313: 'Michelle',
        15314: 'Iona',
        15315: 'Rasheed',

        154: 'Magical Archer',
        15411: 'Sharron',
        15412: 'Cassandra',
        15413: 'Ardella',
        15414: 'Chris',
        15415: 'Bethony',

        155: 'Rakshasa',
        15511: 'Su',
        15512: 'Hwa',
        15513: 'Yen',
        15514: 'Pang',
        15515: 'Ran',

        156: 'Bounty Hunter',
        15611: 'Wayne',
        15612: 'Randy',
        15613: 'Roger',
        15614: 'Walkers',
        15615: 'Jamie',

        157: 'Oracle',
        15711: 'Praha',
        15712: 'Juno',
        15713: 'Seara',
        15714: 'Laima',
        15715: 'Giana',

        158: 'Imp Champion',
        15811: 'Yaku',
        15812: 'Fairo',
        15813: 'Pigma',
        15814: 'Shaffron',
        15815: 'Loque',

        159: 'Mystic Witch',
        15911: 'Megan',
        15912: 'Rebecca',
        15913: 'Silia',
        15914: 'Linda',
        15915: 'Gina',

        160: 'Grim Reaper',
        16011: 'Hemos',
        16012: 'Sath',
        16013: 'Hiva',
        16014: 'Prom',
        16015: 'Thrain',
        16031: 'Hemos',
        16032: 'Sath',
        16033: 'Hiva',
        16034: 'Prom',
        16035: 'Thrain',

        161: 'Occult Girl',
        16111: 'Anavel',
        16112: 'Rica',
        16113: 'Charlotte',
        16114: 'Lora',
        16115: 'Nicki',

        162: 'Death Knight',
        16211: 'Fedora',
        16212: 'Arnold',
        16213: 'Briand',
        16214: 'Conrad',
        16215: 'Dias',

        163: 'Lich',
        16311: 'Rigel',
        16312: 'Antares',
        16313: 'Fuco',
        16314: 'Halphas',
        16315: 'Grego',

        164: 'Skull Soldier',
        16411: '',
        16412: '',
        16413: '',
        16414: '',
        16415: '',

        165: 'Living Armor',
        16511: 'Nickel',
        16512: 'Iron',
        16513: 'Copper',
        16514: 'Silver',
        16515: 'Zinc',

        166: 'Dragon Knight',
        16611: 'Chow',
        16612: 'Laika',
        16613: 'Leo',
        16614: 'Jager',
        16615: 'Ragdoll',

        167: 'Magical Archer Promo',
        16711: '',
        16712: '',
        16713: '',
        16714: 'Fami',
        16715: '',

        168: 'Monkey King',
        16811: 'Shi Hou',
        16812: 'Mei Hou Wang',
        16813: 'Xing Zhe',
        16814: 'Qitian Dasheng',
        16815: 'Son Zhang Lao',

        169: 'Samurai',
        16911: 'Kaz',
        16912: 'Jun',
        16913: 'Kaito',
        16914: 'Tosi',
        16915: 'Sige',

        170: 'Archangel',
        17011: 'Ariel',
        17012: 'Velajuel',
        17013: 'Eladriel',
        17014: 'Artamiel',
        17015: 'Fermion',

        172: 'Drunken Master',
        17211: 'Mao',
        17212: 'Xiao Chun',
        17213: 'Huan',
        17214: 'Tien Qin',
        17215: 'Wei Shin',

        173: 'Kung Fu Girl',
        17311: 'Xiao Lin',
        17312: 'Hong Hua',
        17313: 'Ling Ling',
        17314: 'Liu Mei',
        17315: 'Fei',

        174: 'Beast Monk',
        17411: 'Chandra',
        17412: 'Kumar',
        17413: 'Ritesh',
        17414: 'Shazam',
        17415: 'Rahul',

        175: 'Mischievous Bat',
        17511: '',
        17512: '',
        17513: '',
        17514: '',
        17515: '',

        176: 'Battle Scorpion',
        17611: '',
        17612: '',
        17613: '',
        17614: '',
        17615: '',

        177: 'Minotauros',
        17711: 'Urtau',
        17712: 'Burentau',
        17713: 'Eintau',
        17714: 'Grotau',
        17715: 'Kamatau',

        178: 'Lizardman',
        17811: 'Kernodon',
        17812: 'Igmanodon',
        17813: 'Velfinodon',
        17814: 'Glinodon',
        17815: 'Devinodon',

        179: 'Hell Lady',
        17911: 'Beth',
        17912: 'Raki',
        17913: 'Ethna',
        17914: 'Asima',
        17915: 'Craka',

        180: 'Brownie Magician',
        18011: 'Orion',
        18012: 'Draco',
        18013: 'Aquila',
        18014: 'Gemini',
        18015: 'Korona',

        181: 'Kobold Bomber',
        18111: 'Malaka',
        18112: 'Zibrolta',
        18113: 'Taurus',
        18114: 'Dover',
        18115: 'Bering',

        182: 'King Angelmon',
        18211: 'Blue King Angelmon',
        18212: 'Red King Angelmon',
        18213: 'Gold King Angelmon',
        18214: 'White King Angelmon',
        18215: 'Dark King Angelmon',

        183: 'Sky Dancer',
        18311: 'Mihyang',
        18312: 'Hwahee',
        18313: 'Chasun',
        18314: 'Yeonhong',
        18315: 'Wolyung',

        184: 'Taoist',
        18411: 'Gildong',
        18412: 'Gunpyeong',
        18413: 'Woochi',
        18414: 'Hwadam',
        18415: 'Woonhak',

        185: 'Beast Hunter',
        18511: 'Gangchun',
        18512: 'Nangrim',
        18513: 'Suri',
        18514: 'Baekdu',
        18515: 'Hanra',

        186: 'Pioneer',
        18611: 'Woosa',
        18612: 'Chiwu',
        18613: 'Pungbaek',
        18614: 'Nigong',
        18615: 'Woonsa',

        187: 'Penguin Knight',
        18711: 'Toma',
        18712: 'Naki',
        18713: 'Mav',
        18714: 'Dona',
        18715: 'Kuna',

        188: 'Barbaric King',
        18811: 'Aegir',
        18812: 'Surtr',
        18813: 'Hraesvelg',
        18814: 'Mimirr',
        18815: 'Hrungnir',

        189: 'Polar Queen',
        18911: 'Alicia',
        18912: 'Brandia',
        18913: 'Tiana',
        18914: 'Elenoa',
        18915: 'Lydia',

        190: 'Battle Mammoth',
        19011: 'Talc',
        19012: 'Granite',
        19013: 'Olivine',
        19014: 'Marble',
        19015: 'Basalt',

        191: 'Fairy Queen',
        19111: '',
        19112: '',
        19113: '',
        19114: 'Fran',
        19115: '',

        192: 'Ifrit',
        19211: 'Theomars',
        19212: 'Tesarion',
        19213: 'Akhamamir',
        19214: 'Elsharion',
        19215: 'Veromos',

        193: 'Cow Girl',
        19311: 'Sera',
        19312: 'Anne',
        19313: 'Hannah',
        19314: 'Loren',
        19315: 'Cassie',

        194: 'Pirate Captain',
        19411: 'Galleon',
        19412: 'Carrack',
        19413: 'Barque',
        19414: 'Brig',
        19415: 'Frigate',

        195: 'Charger Shark',
        19511: 'Aqcus',
        19512: 'Ignicus',
        19513: 'Zephicus',
        19514: 'Rumicus',
        19515: 'Calicus',

        196: 'Mermaid',
        19611: 'Tetra',
        19612: 'Platy',
        19613: 'Cichlid',
        19614: 'Molly',
        19615: 'Betta',

        197: 'Sea Emperor',
        19711: 'Poseidon',
        19712: 'Okeanos',
        19713: 'Triton',
        19714: 'Pontos',
        19715: 'Manannan',

        198: 'Magic Knight',
        19811: 'Lapis',
        19812: 'Astar',
        19813: 'Lupinus',
        19814: 'Iris',
        19815: 'Lanett',

        199: 'Assassin',
        19911: 'Stella',
        19912: 'Lexy',
        19913: 'Tanya',
        19914: 'Natalie',
        19915: 'Isabelle',

        200: 'Neostone Fighter',
        20011: 'Ryan',
        20012: 'Trevor',
        20013: 'Logan',
        20014: 'Lucas',
        20015: 'Karl',

        201: 'Neostone Agent',
        20111: 'Emma',
        20112: 'Lisa',
        20113: 'Olivia',
        20114: 'Illiana',
        20115: 'Sylvia',

        202: 'Martial Artist',
        20211: 'Luan',
        20212: 'Sin',
        20213: 'Lo',
        20214: 'Hiro',
        20215: 'Jackie',

        203: 'Mummy',
        20311: 'Nubia',
        20312: 'Sonora',
        20313: 'Namib',
        20314: 'Sahara',
        20315: 'Karakum',

        204: 'Anubis',
        20411: 'Avaris',
        20412: 'Khmun',
        20413: 'Iunu',
        20414: 'Amarna',
        20415: 'Thebae',

        205: 'Desert Queen',
        20511: 'Bastet',
        20512: 'Sekhmet',
        20513: 'Hathor',
        20514: 'Isis',
        20515: 'Nephthys',

        206: 'Horus',
        20611: 'Qebehsenuef',
        20612: 'Duamutef',
        20613: 'Imesety',
        20614: 'Wedjat',
        20615: 'Amduat',

        207: "Jack-o'-lantern",
        20711: 'Chilling',
        20712: 'Smokey',
        20713: 'Windy',
        20714: 'Misty',
        20715: 'Dusky',

        208: 'Frankenstein',
        20811: 'Tractor',
        20812: 'Bulldozer',
        20813: 'Crane',
        20814: 'Driller',
        20815: 'Crawler',

        209: 'Elven Ranger',
        20911: 'Eluin',
        20912: 'Adrian',
        20913: 'Erwin',
        20914: 'Lucien',
        20915: 'Isillen',

        210: 'Harg',
        21011: 'Remy',
        21012: 'Racuni',
        21013: 'Raviti',
        21014: 'Dova',
        21015: 'Kroa',

        211: 'Fairy King',
        21111: 'Psamathe',
        21112: 'Daphnis',
        21113: 'Ganymede',
        21114: 'Oberon',
        21115: 'Nyx',

        212: 'Panda Warrior',
        21211: 'Mo Long',
        21212: 'Xiong Fei',
        21213: 'Feng Yan',
        21214: 'Tian Lang',
        21215: 'Mi Ying',

        213: 'Dice Magician',
        21311: 'Reno',
        21312: 'Ludo',
        21313: 'Morris',
        21314: 'Tablo',
        21315: 'Monte',

        214: 'Harp Magician',
        21411: 'Sonnet',
        21412: 'Harmonia',
        21413: 'Triana',
        21414: 'Celia',
        21415: 'Vivachel',

        215: 'Unicorn',
        21511: 'Amelia',
        21512: 'Helena',
        21513: 'Diana',
        21514: 'Eleanor',
        21515: 'Alexandra',
        21611: 'Amelia',
        21612: 'Helena',
        21613: 'Diana',
        21614: 'Eleanor',
        21615: 'Alexandra',

        218: 'Paladin',
        21811: 'Josephine',
        21812: 'Ophilia',
        21813: 'Louise',
        21814: 'Jeanne',
        21815: 'Leona',

        219: 'Chakram Dancer',
        21911: 'Talia',
        21912: 'Shaina',
        21913: 'Melissa',
        21914: 'Deva',
        21915: 'Belita',

        220: 'Boomerang Warrior',
        22011: 'Sabrina',
        22012: 'Maruna',
        22013: 'Zenobia',
        22014: 'Bailey',
        22015: 'Martina',

        221: 'Dryad',
        22111: 'Herne',
        22112: 'Nisha',
        22113: 'Mellia',
        22114: 'Felleria',
        22115: 'Hyanes',

        222: 'Druid',
        22211: 'Abellio',
        22212: 'Bellenus',
        22213: 'Taranys',
        22214: 'Valantis',
        22215: 'Pater',
        22311: 'Abellio',
        22312: 'Bellenus',
        22313: 'Taranys',
        22314: 'Valantis',
        22315: 'Pater',

        224: 'Giant Warrior',
        22411: 'Bagir',
        22412: 'Vidurr',
        22413: 'Skogul',
        22414: 'Einheri',
        22415: 'Trasar',
        22513: 'Skogul',
        22515: 'Trasar',

        226: 'Lightning Emperor',
        22611: 'Bolverk',
        22612: 'Baleygr',
        22613: 'Odin',
        22614: 'Geldnir',
        22615: 'Herteit',

        227: 'Sniper Mk.I',
        22711: 'Covenant',
        22712: 'Carcano',
        22713: 'Carbine',
        22714: 'Magnum',
        22715: 'Dragunov',
        228: 'Sniper Mk.I',
        22812: 'Carcano',
        22813: 'Carbine',
        22815: 'Dragunov',

        229: 'Cannon Girl',
        22911: 'Abigail',
        22912: 'Scarlett',
        22913: 'Christina',
        22914: 'Emily',
        22915: 'Bella',

        23005: 'Vampire Lord',
        23015: 'Eirgar',

        231: 'Demon',
        23111: 'Belial',
        23112: 'Bael',
        23113: 'Mephisto',
        23114: 'Lucifer',
        23115: 'Beelzebub',
        232: 'Demon',
        23211: 'Belial',
        23215: 'Beelzebub',

        233: 'Gargoyle',
        23311: 'Tanzaite',
        23312: 'Kunite',
        23313: 'Malite',
        23314: 'Pheneka',
        23315: 'Onyx',
        234: 'Gargoyle',
        23411: 'Tanzaite',
        23412: 'Kunite',
        23413: 'Malite',
        23414: 'Pheneka',
        23415: 'Onyx',

        235: 'Beast Rider',
        23511: 'Barbara',
        23512: 'Masha',
        23513: 'Savannah',
        23514: 'Narsha',
        23515: 'Xiana',
        236: 'Beast Rider',
        23611: 'Barbara',
        23612: 'Masha',
        23613: 'Savannah',
        23614: 'Narsha',
        23615: 'Xiana',

        237: 'Art Master',
        23711: 'Haegang',
        23712: 'Jeogun',
        23713: 'Cheongpung',
        23714: 'Hanwul',
        23715: 'Mookwol',

        239: 'String Master',
        23911: 'Songseol',
        23912: 'Hongyeon',
        23913: 'Yeonhwa',
        23914: 'Dongbaek',
        23915: 'Mirinae',

        240: 'RYU',
        24011: 'RYU',
        24012: 'RYU',
        24013: 'RYU',
        24014: 'RYU',
        24015: 'RYU',

        241: 'KEN',

        242: 'M. BISON',
        24211: 'M. BISON',
        24212: 'M. BISON',
        24213: 'M. BISON',
        24214: 'M. BISON',
        24215: 'M. BISON',

        243: 'DHALSIM',
        24311: 'DHALSIM',
        24312: 'DHALSIM',
        24313: 'DHALSIM',
        24314: 'DHALSIM',
        24315: 'DHALSIM',

        244: 'CHUN-LI',
        24411: 'CHUN-LI',
        24412: 'CHUN-LI',
        24413: 'CHUN-LI',
        24414: 'CHUN-LI',
        24415: 'CHUN-LI',

        245: 'Striker',
        24511: 'Moore',
        24512: 'Douglas',
        24513: 'Kashmir',
        24514: 'Talisman',
        24515: 'Vancliffe',

        246: 'Shadow Claw',
        24612: 'Bernadotte',

        247: 'Slayer',
        24711: 'Borgnine',
        24712: 'Karnal',
        24713: 'Sagar',
        24714: 'Craig',
        24715: 'Gurkha',

        248: 'Poison Master',
        24811: 'Kyle',
        24812: 'Todd',
        24813: 'Jarrett',
        24814: 'Hekerson',
        24815: 'Cayde',

        249: 'Blade Dancer',
        24911: 'Lariel',
        24912: 'Berenice',
        24913: 'Cordelia',
        24914: 'Leah',
        24915: 'Vereesa',

        250: 'Onmyouji',
        25011: 'Shizuka',
        25012: 'Tomoe',
        25013: 'Giou',
        25014: 'Seimei',
        25015: 'Douman',

        251: 'Onimusha',
        25111: 'Suiki',
        25112: 'Kaki',
        25113: 'Fuuki',
        25114: 'Kinki',
        25115: 'Ongyouki',

        252: 'Mage',
        25211: 'Nana',
        25212: 'Coco',
        25213: 'Momo',
        25214: 'Dorothy',
        25215: 'Kiki',

        253: 'Sky Surfer',
        25311: 'Miles',
        25312: 'John',
        25313: 'Oliver',
        25314: 'Daniel',
        25315: 'Jackson',

        254: 'ROBO',
        25411: 'ROBO-R40',
        25412: 'ROBO-P27',
        25413: 'ROBO-G92',
        25414: 'ROBO-E65',
        25415: 'ROBO-F29',

        256: 'Totemist',
        25611: 'Aaaliyah',
        25612: 'Nora',
        25613: 'Riley',
        25614: 'Ella',
        25615: 'Maya',

        257: 'Weapon Master',
        25711: 'Liam',
        25712: 'Carlos',
        25713: 'Dominic',
        25714: 'Benedict',
        25715: 'Maximilian',

        258: 'Rune Hammer Blacksmith',
        25811: 'Susan',
        25812: 'Miriam',
        25813: 'Celine',
        25814: 'Madeleine',
        25815: 'Deborah',

        259: 'Shadowcaster',
        25911: 'Minato',
        25912: 'Ren',
        25913: 'Zen',
        25914: 'Shun',
        25915: 'Ritsu',

        260: 'Hypnomeow',
        26011: 'Birman',
        26012: 'Manx',
        26013: 'Nebelung',
        26014: 'Siamese',
        26015: 'Bombay',

        261: 'Battle Angel',
        26111: 'Amber',
        26112: 'Claire',
        26113: 'Sonia',
        26114: 'Veronica',
        26115: 'Destiny',

        262: 'GingerBrave',

        263: 'Pure Vanilla Cookie',
        26311: 'Pure Vanilla Cookie',
        26312: 'Pure Vanilla Cookie',
        26313: 'Pure Vanilla Cookie',
        26314: 'Pure Vanilla Cookie',
        26315: 'Pure Vanilla Cookie',

        264: 'Hollyberry Cookie',
        26411: 'Hollyberry Cookie',
        26412: 'Hollyberry Cookie',
        26413: 'Hollyberry Cookie',
        26414: 'Hollyberry Cookie',
        26415: 'Hollyberry Cookie',

        265: 'Espresso Cookie',
        26511: 'Espresso Cookie',
        26512: 'Espresso Cookie',
        26513: 'Espresso Cookie',
        26514: 'Espresso Cookie',
        26515: 'Espresso Cookie',

        266: 'Madeleine Cookie',
        26611: 'Madeleine Cookie',
        26612: 'Madeleine Cookie',
        26613: 'Madeleine Cookie',
        26614: 'Madeleine Cookie',
        26615: 'Madeleine Cookie',

        267: 'Lollipop Warrior',
        26713: 'Thomas',

        268: 'Pudding Princess',
        26811: 'Adriana',
        26812: 'Lucia',
        26813: 'Angela',
        26814: 'Ariana',
        26815: 'Elena',

        269: 'Macaron Guard',
        26911: 'Manon',
        26912: 'Alice',
        26913: 'Jade',
        26914: 'Audrey',
        26915: 'Giselle',

        270: 'Black Tea Bunny',
        27011: 'Rosemary',
        27012: 'Hibiscus',
        27013: 'Chamomile',
        27014: 'Jasmine',
        27015: 'Lavender',

        271: 'Choco Knight',
        27111: 'Ganache',
        27112: 'Pavé',
        27113: 'Praline',
        27114: 'Fudge',
        27115: 'Truffle',

        272: 'Puppeteer',
        27211: 'Zibala',
        27212: 'Zima',
        27213: 'Smicer',
        27214: 'Kovarci',
        27215: 'Zenisek',

        27314: 'Altaïr',

        274: 'Ezio',
        27411: 'Ezio',
        27412: 'Ezio',
        27413: 'Ezio',
        27414: 'Ezio',
        27415: 'Ezio',

        275: 'Bayek',
        27511: 'Bayek',
        27512: 'Bayek',
        27513: 'Bayek',
        27514: 'Bayek',
        27515: 'Bayek',

        276: 'Kassandra',
        27611: 'Kassandra',
        27612: 'Kassandra',
        27613: 'Kassandra',
        27614: 'Kassandra',
        27615: 'Kassandra',

        277: 'Eivor',
        27711: 'Eivor',
        27712: 'Eivor',
        27713: 'Eivor',
        27714: 'Eivor',
        27715: 'Eivor',

        278: 'Dual Blade',
        27814: 'Frederic',

        279: 'Steel Commander',
        27911: 'Lionel',
        27912: 'Patrick',
        27913: 'Hector',
        27914: 'Ian',
        27915: 'Evan',

        280: 'Desert Warrior',
        28011: 'Omar',
        28012: 'Ashour',
        28013: 'Shahat',
        28014: 'Ahmed',
        28015: 'Salah',

        281: 'Gladiatrix',
        28111: 'Kalantatze',
        28112: 'Federica',
        28113: 'Eleni',
        28114: 'Aurelia',
        28115: 'Kiara',

        282: 'Mercenary Queen',
        28211: 'Brita',
        28212: 'Solveig',
        28213: 'Astrid',
        28214: 'Berghild',
        28215: 'Sigrid',

        283: 'Indra',
        28311: 'Parjanya',
        28312: 'Vendhan',
        28313: 'Chakra',
        28314: 'Dyeus',
        28315: 'Devaraja',
        28411: 'Parjanya',
        28412: 'Vendhan',
        28413: 'Chakra',
        28414: 'Dyeus',
        28415: 'Devaraja',

        285: 'Asura',
        28511: 'Mayasura',
        28512: 'Varuna',
        28513: 'Usha',
        28514: 'Danu',
        28515: 'Vritra',

        286: 'Devil Maiden',
        28611: 'Irène',
        28612: 'Bloodya',
        28613: 'Layla',
        28614: 'Jessica',
        28615: 'Liliana',

        289: 'Dokkaebi Lord',
        28911: 'Jeongnam',
        28912: 'Moogwang',
        28913: 'Byungchul',
        28914: 'Euldong',
        28915: 'Gapsoo',

        290: 'Dokkaebi Princess and Sapsaree',
        29011: 'Minji and Sapsaree',
        29012: 'Yeji and Sapsaree',
        29013: 'Yuna and Sapsaree',
        29014: 'Eunbee and Sapsaree',
        29015: 'Damee and Sapsaree',

        15105: 'Devilmon',
        14314: 'Rainbowmon',

        1000111: 'Homunculus - Attack (Water)',
        1000112: 'Homunculus - Attack (Fire)',
        1000113: 'Homunculus - Attack (Wind)',

        1000214: 'Homunculus - Support (Light)',
        1000215: 'Homunculus - Support (Dark)',
    }
}