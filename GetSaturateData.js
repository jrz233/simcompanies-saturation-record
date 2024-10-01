const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// 全局配置的 axios 实例
const axiosInstance = axios.create({
    timeout: 5000, // 5秒超时
});

// 获取市场饱和度
async function getMarketData(realm_id, retries = 10) {
    const url = `https://www.simcompanies.com/api/v4/${realm_id}/resources-retail-info`;
    try {
        console.log(`[INFO] 开始获取 realm ${realm_id} 的市场饱和度。`);
        const response = await axiosInstance.get(url);
        const marketData = response.data;
        const marketDataMap = {};
        marketData.forEach(item => {
            marketDataMap[item.dbLetter] = item.saturation;
        });
        console.log(`[INFO] 成功获取 realm ${realm_id} 的市场饱和度。`);
        return marketDataMap;
    } catch (error) {
        console.warn(`[WARN] 获取 realm ${realm_id} 的市场饱和度失败。重试次数剩余: ${retries - 1}，错误信息: ${error.message}`);
        if (retries > 0) {
            return getMarketData(realm_id, retries - 1);
        }
        console.error(`[ERROR] 获取 realm ${realm_id} 的市场饱和度时发生错误:`, error.message);
        return {}; // 返回空对象以防止后续处理失败
    }
}

// 检查 id 为 3 的值是否大于 0
async function checkId3Saturation(realm_id) {
    console.log(`[INFO] 开始检查 realm ${realm_id} 中 id 3 的饱和度值。`);
    let data;
    do {
        data = await getMarketData(realm_id);
        if (Object.keys(data).length === 0) {
            console.error('[ERROR] 接收到空数据，正在重试...');
        }
    } while (!data.hasOwnProperty('3') || data['3'] <= 0);
    console.log(`[INFO] realm ${realm_id} 中 id 3 的饱和度值大于 0，检查通过。`);
    return data;
}

// 获取当前日期并格式化为 "YYYY/MM/DD"
function getFormattedDate(date = new Date()) {
    return date.toLocaleDateString("zh-CN", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\./g, '/');
}

// 确保目录存在
async function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    try {
        await fs.mkdir(dirname, { recursive: true });
        console.log(`[INFO] 目录已创建: ${dirname}`);
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`[ERROR] 创建目录时发生错误: ${error.message}`);
        }
    }
}

// 保存数据到文件
async function saveDataToFile(filename, realm_id, data) {
    const filePath = path.resolve(__dirname, filename);
    await ensureDirectoryExistence(filePath);
    let fileData = {};
    
    try {
        const rawData = await fs.readFile(filePath, 'utf-8');
        fileData = JSON.parse(rawData);
        console.log(`[INFO] 成功读取文件 ${filename} 的现有数据。`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`[ERROR] 读取或解析现有文件时发生错误: ${error.message}`);
            return;
        }
    }

    const currentDate = getFormattedDate();
    // 更新今天的数据
    fileData[currentDate] = { ...data };

    // 备份文件
    try {
        const backupPath = `${filePath}.bak`;
        await fs.copyFile(filePath, backupPath);
        console.log(`[INFO] 成功备份文件: ${backupPath}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`[WARN] 备份文件时未找到源文件，跳过备份: ${filePath}`);
        } else {
            console.error(`[ERROR] 备份文件时发生错误: ${error.message}`);
        }
    }
    try {
        // 保存为压缩的 JSON 格式
        await fs.writeFile(filePath, JSON.stringify(fileData, null, 0));
        console.log(`[INFO] 数据已成功保存到 ${filename}`);
    } catch (error) {
        console.error(`[ERROR] 写入数据到文件时发生错误: ${error.message}`);
    }
    await cleanOldData(filePath); // 清理旧数据
}

// 清理超过一年的数据
async function cleanOldData(filePath) {
    const oneYearAgoString = getFormattedDate(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
    try {
        const rawData = await fs.readFile(filePath, 'utf-8');
        const fileData = JSON.parse(rawData);
        // 删除超过一年的数据
        Object.keys(fileData).forEach(date => {
            if (date < oneYearAgoString) {
                delete fileData[date];
            }
        });
        // 保存为压缩格式
        await fs.writeFile(filePath, JSON.stringify(fileData, null, 0));
        console.log(`[INFO] 已成功清理 ${filePath} 中超过一年的旧数据。`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`[ERROR] 清理旧数据时发生错误: ${error.message}`);
        } else {
            console.warn(`[WARN] 文件 ${filePath} 不存在，跳过清理操作。`);
        }
    }
}


// 主函数，运行程序
async function run() {
    const realmIds = [0, 1]; // 分别获取 realm 0 和 1 的数据
    const filenames = ['data/R1_saturation.json', 'data/R2_saturation.json'];
    const tasks = realmIds.map(async (realm_id, index) => {
        const filename = filenames[index];
        console.log(`[INFO] 开始处理 realm ${realm_id}。`);

        try {
            // 获取市场饱和度数据
            const marketData = await checkId3Saturation(realm_id);
            // 保存今天的数据，并覆盖旧的今天的数据
            await saveDataToFile(filename, realm_id, marketData);
            console.log(`[INFO] realm ${realm_id} 的数据已成功获取并保存。`);
        } catch (error) {
            console.error(`[ERROR] 处理 realm ${realm_id} 时发生错误: ${error.message}`);
        }
    });
    await Promise.all(tasks); // 并行执行所有任务
    console.log('[INFO] 所有任务已完成。');
}

run().catch(error => console.error(`[ERROR] 运行程序时发生错误: ${error.message}`));
