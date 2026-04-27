const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PART1 = path.join(ROOT, 'docs/gallery-part-1.md');
const PART2 = path.join(ROOT, 'docs/gallery-part-2.md');
const OUT_DIR = path.join(ROOT, 'gallery-site');
const OUT_FILE = path.join(OUT_DIR, 'data.js');

const IMAGE_BASE = 'https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data/images/';

// Category mapping rules
const CATEGORY_RULES = [
  { category: 'UI与界面', keywords: ['界面', 'UI', 'app', '应用', '截图', '社媒', '仪表盘', 'dashboard'] },
  { category: '图表与信息可视化', keywords: ['信息图', '可视化', '图表', '数据', 'infographic', '图谱', '矩阵', '分解图', '详解图', '流程'] },
  { category: '海报与排版', keywords: ['海报', '排版', '版式', 'poster', '封面', '杂志'] },
  { category: '商品与电商', keywords: ['商品', '电商', '产品', '品牌宣传', '购物', '零食'] },
  { category: '品牌与标志', keywords: ['品牌', '标志', 'logo', '标识', '徽章'] },
  { category: '建筑与空间', keywords: ['建筑', '空间', '室内', '城市', '地图'] },
  { category: '摄影与写实', keywords: ['摄影', '写真', '照片', '写实', '直播', 'portrait'] },
  { category: '插画与艺术', keywords: ['插画', '艺术', '手绘', '水彩', '油画', '绘画', '刺绣', '涂鸦'] },
  { category: '人物与角色', keywords: ['人物', '角色', '人设', '头像', '卡通人'] },
  { category: '场景与叙事', keywords: ['场景', '叙事', '故事', '电影'] },
  { category: '历史与古风题材', keywords: ['历史', '古风', '古代', '朝代', '长卷', '诗词', '药方', '朋友圈'] },
  { category: '文档与出版物', keywords: ['文档', '出版', '书籍', '论文', '手册'] },
];

function classifyTitle(title) {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return rule.category;
      }
    }
  }
  return '其他应用场景';
}

function parseCases(content) {
  const cases = [];
  // Split by case anchors
  const caseBlocks = content.split(/(?=<a name="case-\d+")/);

  for (const block of caseBlocks) {
    // Match case anchor
    const anchorMatch = block.match(/<a name="case-(\d+)">/);
    if (!anchorMatch) continue;

    const id = parseInt(anchorMatch[1], 10);

    // Match title
    const titleMatch = block.match(/###\s*例\s*\d+[：:]\s*(.+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Match image filename (alt text may span multiple lines)
    const imageMatch = block.match(/!\[[\s\S]*?\]\(\.\.\/(data\/images\/[^)]+)\)/);
    if (!imageMatch) continue;
    const imagePath = imageMatch[1];
    const filename = path.basename(imagePath);
    const image = IMAGE_BASE + filename;

    // Match source
    const sourceMatch = block.match(/\*\*来源[：:]\*\*\s*(.+)/);
    const source = sourceMatch ? sourceMatch[1].trim() : '未提供';

    // Match prompt (content between ```text and ```) - handle \r\n and \n
    const promptMatch = block.match(/```text\r?\n([\s\S]*?)```/);
    const prompt = promptMatch ? promptMatch[1].trim() : '';

    const category = classifyTitle(title);

    cases.push({ id, title, image, source, prompt, category });
  }

  return cases;
}

function escapeForJS(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function generateDataJS(cases) {
  let output = 'window.GALLERY_DATA = [\n';
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    output += '  {\n';
    output += `    id: ${c.id},\n`;
    output += `    title: '${escapeForJS(c.title)}',\n`;
    output += `    image: '${escapeForJS(c.image)}',\n`;
    output += `    source: '${escapeForJS(c.source)}',\n`;
    output += `    prompt: '${escapeForJS(c.prompt)}',\n`;
    output += `    category: '${escapeForJS(c.category)}'\n`;
    output += '  }';
    if (i < cases.length - 1) output += ',';
    output += '\n';
  }
  output += '];\n';
  return output;
}

// Main
const content1 = fs.readFileSync(PART1, 'utf-8');
const content2 = fs.readFileSync(PART2, 'utf-8');

const cases1 = parseCases(content1);
const cases2 = parseCases(content2);
const allCases = [...cases1, ...cases2].sort((a, b) => a.id - b.id);

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Write data file
const dataJS = generateDataJS(allCases);
fs.writeFileSync(OUT_FILE, dataJS, 'utf-8');

// Print statistics
console.log(`\n✅ 解析完成！`);
console.log(`📊 总案例数: ${allCases.length}`);
console.log(`   - Part 1: ${cases1.length} 条`);
console.log(`   - Part 2: ${cases2.length} 条`);
console.log(`\n📁 输出文件: ${OUT_FILE}`);
console.log(`\n📂 分类统计:`);

const categoryCount = {};
for (const c of allCases) {
  categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
}
const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
for (const [cat, count] of sorted) {
  console.log(`   ${cat}: ${count}`);
}
