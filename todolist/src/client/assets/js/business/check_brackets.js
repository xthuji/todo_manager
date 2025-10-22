const fs = require('fs');
const path = require('path');

// 读取文件内容
const content = fs.readFileSync('weather_view.js', 'utf8');
const lines = content.split('\n');

let bracketCount = 0;
let lastOpeningLine = -1;
let lastOpeningContext = '';

// 逐行检查括号平衡
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查这一行的花括号
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') {
            bracketCount++;
            lastOpeningLine = i + 1;
            lastOpeningContext = line.trim();
        } else if (line[j] === '}') {
            bracketCount--;
        }
    }
    
    // 如果括号数量变为负数，说明有未匹配的右括号
    if (bracketCount < 0) {
        console.log(`错误: 在第 ${i + 1} 行发现未匹配的右括号`);
        console.log(`上下文: ${line.trim()}`);
        break;
    }
}

// 检查最终括号平衡
if (bracketCount > 0) {
    console.log(`错误: 文件末尾缺少 ${bracketCount} 个右花括号`);
    console.log(`最后一个未匹配的左花括号在第 ${lastOpeningLine} 行`);
    console.log(`上下文: ${lastOpeningContext}`);
} else if (bracketCount < 0) {
    console.log(`错误: 总共多了 ${Math.abs(bracketCount)} 个右花括号`);
} else {
    console.log('括号平衡，没有发现问题');
}