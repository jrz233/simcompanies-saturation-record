const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 获取市场饱和度
async function getMarketData(realm_id, retries = 3) {
    const url = `https://www.simcompanies.com/api/v4/${realm_id}/resources-retail-info`;
    try {
        const response = await axios.get(url);
        const marketData = response.data;
        const marketDataMap = {};
        marketData.forEach(item => {
            // 只保留饱和度大于0的数据
            if (item.saturation > 0) {
                marketDataMap[item.id] = item.saturation;
            }
        });
        return marketDataMap;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Retrying... (${3 - retries + 1})`);
            return getMarketData(realm_id, retries - 1);
        }
        console.error(`Error fetching market data for realm ${realm_id}:`, error.message);
        return {}; // 返回空对象以防止后续处理失败
    }
}

// 检查id为3的值是否大于0
async function checkId3Saturation(realm_id) {
    let data;
    do {
        data = await getMarketData(realm_id);
        if (Object.keys(data).length === 0) {
            console.error('Received empty data, retrying...');
        }
    } while (data['3'] <= 0);
    return data;
}

// 获取当前上海时间
function getShanghaiDate() {
    const shanghaiTime = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const date = new Date(shanghaiTime);
    return date.toISOString().split('T')[0]; // 格式化为"YYYY-MM-DD"
}

// 检查文件是否已有今天的数据
function checkTodayDataExists(filename) {
    const filePath = path.resolve(__dirname, filename);
    const currentDate = getShanghaiDate();

    if (fs.existsSync(filePath)) {
        try {
            const rawData = fs.readFileSync(filePath);
            const fileData = JSON.parse(rawData);
            if (fileData[currentDate]) {
                console.log(`Today's data for ${filename} already exists.`);
                return true; // 今天的数据已经存在
            }
        } catch (error) {
            console.error('Error reading or parsing existing file:', error.message);
        }
    }
    return false; // 文件不存在或今天的数据不存在
}

// 保存数据到文件
function saveDataToFile(filename, realm_id, data) {
    const filePath = path.resolve(__dirname, filename);

    let fileData = {};

    // 如果文件存在，读取现有数据
    if (fs.existsSync(filePath)) {
        try {
            const rawData = fs.readFileSync(filePath);
            fileData = JSON.parse(rawData);
        } catch (error) {
            console.error('Error reading or parsing existing file:', error.message);
            return; // 读取或解析失败时返回
        }
    }

    const currentDate = getShanghaiDate();

    // 更新文件中已有的其他天的数据，或添加今天的数据
    fileData[currentDate] = fileData[currentDate] || {}; // 保留其他天的数据，并初始化今天的数据
    fileData[currentDate][realm_id] = data; // 更新今天的数据

    // 写入文件
    try {
        const backupPath = `${filePath}.bak`;
        fs.copyFileSync(filePath, backupPath); // 备份文件
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 4)); // 以漂亮的JSON格式写入
        console.log(`Data saved to ${filename}`);
    } catch (error) {
        console.error('Error writing data to file:', error.message);
    }

    // 清理超过一年的数据
    cleanOldData(filePath);
}

// 清理超过一年的数据
function cleanOldData(filePath) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoString = oneYearAgo.toISOString().split('T')[0]; // 格式化为"YYYY-MM-DD"

    try {
        const rawData = fs.readFileSync(filePath);
        const fileData = JSON.parse(rawData);

        // 删除超过一年的数据
        Object.keys(fileData).forEach(date => {
            if (date < oneYearAgoString) {
                delete fileData[date]; // 删除超过一年的数据
            }
        });

        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 4)); // 更新文件
        console.log(`Old data cleaned from ${filePath}`);
    } catch (error) {
        console.error('Error cleaning old data:', error.message);
    }
}

// 主函数，运行程序
async function run() {
    const realmIds = [0, 1]; // 分别获取realm 0和1的数据
    const filenames = ['R1_saturation.json', 'R2_saturation.json'];

    for (let i = 0; i < realmIds.length; i++) {
        const realm_id = realmIds[i];
        const filename = filenames[i];

        // 检查是否已有今天的数据，已有则跳过获取数据
        if (checkTodayDataExists(filename)) {
            continue;
        }

        try {
            const marketData = await checkId3Saturation(realm_id);
            saveDataToFile(filename, realm_id, marketData);
        } catch (error) {
            console.error(`Error processing realm ${realm_id}:`, error.message);
        }
    }
}

run().catch(console.error);
