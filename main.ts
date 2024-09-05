import { serve } from "https://deno.land/std@0.114.0/http/server.ts";

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ECharts Example</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
    <style>
        .chart-container {
            width: 100%;
            height: 1300px; /* 调整每个图表的高度 */
            margin-bottom: 20px; /* 图表间距 */
        }
    </style>
</head>
<body>
    <div id="freshStore" class="chart-container"></div>
    <div id="hardwareStore" class="chart-container"></div>
    <div id="gasStation" class="chart-container"></div>
    <div id="fashionStore" class="chart-container"></div>
    <div id="electronicsStore" class="chart-container"></div>
    <div id="carDealership" class="chart-container"></div>
    <div id="aerospace" class="chart-container"></div>

    <script>
        const idToName = {
            '苹果': 3,
            '橘子': 4,
            '葡萄': 5,
            '牛排': 7,
            '香肠': 8,
            '鸡蛋': 9,
            '汽油': 11,
            '柴油': 12,
            '智能手机': 24,
            '平板电脑': 25,
            '笔记本电脑': 26,
            '显示器': 27,
            '电视机': 28,
            '经济电动车': 53,
            '豪华电动车': 54,
            '经济燃油车': 55,
            '豪华燃油车': 56,
            '卡车': 57,
            '内衣': 60,
            '手套': 61,
            '裙子': 62,
            '高跟鞋': 63,
            '手袋': 64,
            '运动鞋': 65,
            '圣诞脆饼': 67,
            '名牌手表': 70,
            '项链': 71,
            '无人机': 98,
            '砖块': 102,
            '水泥': 103,
            '木板': 108,
            '窗户': 109,
            '工具': 110,
            '咖啡粉': 119,
            '蔬菜': 120,
            '面包': 121,
            '芝士': 122,
            '苹果派': 123,
            '橙汁': 124,
            '苹果汁': 125,
            '姜汁啤酒': 126,
            '披萨': 127,
            '面条': 128,
            '巧克力': 140,
            'Xmas ornament': 144
        };

        const idMappings = {
            freshStore: [3, 4, 5, 7, 8, 9, 67, 119, 122, 123, 124, 125, 126, 127, 140, 144],
            hardwareStore: [102, 103, 108, 109, 110],
            gasStation: [11, 12],
            fashionStore: [60, 61, 62, 63, 64, 65, 70, 71],
            electronicsStore: [24, 25, 26, 27, 28, 98],
            carDealership: [53, 54, 55, 56, 57],
            aerospace: [91, 94, 95, 96, 97, 99]
        };

        fetch('https://api.github.com/repos/gangbaRuby/simcompanies-saturation-record/contents/data/saturation.json')
            .then(response => response.json())
            .then(data => {
                const content = atob(data.content); // 解码 base64
                const jsonData = JSON.parse(content); // 解析 JSON

                // 解析日期
                const dates = Object.keys(jsonData).sort((a, b) => new Date(a) - new Date(b)); // 确保日期按升序排序

                // 获取今天的日期并计算最近7天的日期
                const today = new Date();
                const last7Days = dates.filter(date => new Date(date) >= new Date(today - 7 * 24 * 60 * 60 * 1000));
                
                // 获取每个图表的数据并绘制
                Object.entries(idMappings).forEach(([key, ids]) => {
                    const seriesData = ids.map(id => ({
                        name: Object.keys(idToName).find(name => idToName[name] === id), // 将 ID 映射为名称
                        type: 'line',
                        data: last7Days.map(date => jsonData[date][id] || 0), // 使用最近7天的数据
                        label: {
                            show: true, // 显示数据标签
                            position: 'top', // 标签位置
                            formatter: '{c}' // 数据标签内容格式
                        }
                    }));

                    const containerId = key;
                    const container = document.getElementById(containerId);

                    if (container) {
                        const chart = echarts.init(container);

                        const option = {
                            title: {
                                text: {
                                    freshStore: '生鲜商店',
                                    hardwareStore: '五金商店',
                                    gasStation: '加油站',
                                    fashionStore: '时装商店',
                                    electronicsStore: '电子产品商店',
                                    carDealership: '车行',
                                    aerospace: '航天'
                                }[key] + ' 饱和度'
                            },
                            tooltip: {
                                trigger: 'axis'
                            },
                            legend: {
                                data: seriesData.map(series => series.name) // 使用名称作为图例项
                            },
                            xAxis: {
                                type: 'category',
                                data: last7Days
                            },
                            yAxis: {
                                type: 'value'
                            },
                            series: seriesData,
                            dataZoom: [
                                {
                                    type: 'slider',  // 使用滑块组件
                                    show: true,
                                    xAxisIndex: [0],
                                    start: 0, // 默认显示范围的起始位置
                                    end: 100 // 默认显示范围的结束位置
                                },
                                {
                                    type: 'inside',  // 内部缩放（可通过鼠标滚轮）
                                    xAxisIndex: [0]
                                }
                            ]
                        };

                        chart.setOption(option);
                    } else {
                        console.error(\`Container with ID \${containerId} not found.\`);
                    }
                });

                // 调整图表大小以适应窗口变化
                window.addEventListener('resize', () => {
                    Object.keys(idMappings).forEach(key => {
                        const containerId = key;
                        const container = document.getElementById(containerId);
                        const chart = echarts.getInstanceByDom(container);
                        if (chart) chart.resize();
                    });
                });
            })
            .catch(error => console.error('Error fetching data:', error));
    </script>
</body>
</html>
`;

serve((req) => {
  return new Response(htmlContent, {
    headers: { "content-type": "text/html" },
  });
});
