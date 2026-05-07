/**
 * 统一构建脚本：生成 arts_data.json 和 logo_data.json
 *
 * 功能：
 * 1. 读取 scripts/arts_data.csv 和 scripts/ark_chars.csv（两个来源的立绘数据）
 * 2. 扫描 public/chararts/，给立绘条目标记 内置: true/false
 * 3. 扫描 public/logos/，生成 logo_data.json
 * 4. 生成 public/arts_data.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 设为 false 可跳过方舟干员数据同步，加速调试 */
const SYNC_ARK_CHARS = false;

// --- CSV 解析 ---

function parseCSV(text) {
  // 移除 UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        if (text[i + 1] === '\n') i++;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }

  // 最后一行
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvDictReader(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return { fieldnames: [], records: [] };

  const fieldnames = rows[0];
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length === 1 && rows[i][0] === '') continue; // 跳过空行
    const record = {};
    for (let j = 0; j < fieldnames.length; j++) {
      record[fieldnames[j]] = rows[i][j] !== undefined ? rows[i][j] : '';
    }
    records.push(record);
  }

  return { fieldnames, records };
}

// --- 项目路径 ---

function findProjectRoot() {
  /** 从脚本所在目录向上查找项目根目录（包含 public/ 的目录） */
  let candidate = __dirname;
  for (let i = 0; i < 3; i++) {
    if (existsSync(join(candidate, 'public'))) {
      return candidate;
    }
    candidate = dirname(candidate);
  }
  // 回退：假设脚本在 scripts/ 下，项目根是其父目录
  return dirname(__dirname);
}

// --- 扫描 ---

function scanChararts(publicDir) {
  /** 扫描 public/chararts/，返回内置立绘文件名集合 */
  const charartsDir = join(publicDir, 'chararts');
  if (!existsSync(charartsDir)) {
    console.log(`警告: chararts 目录不存在: ${charartsDir}`);
    mkdirSync(charartsDir, { recursive: true });
    return new Set();
  }
  const files = new Set(
    readdirSync(charartsDir).filter(f => f.toLowerCase().endsWith('.png'))
  );
  console.log(`扫描到 ${files.size} 个内置立绘文件`);
  return files;
}

function scanLogos(publicDir) {
  /** 扫描 public/logos/，返回 [{logo, ext}] 数组（按中文拼音排序） */
  const logosDir = join(publicDir, 'logos');
  if (!existsSync(logosDir)) {
    console.log(`警告: logos 目录不存在: ${logosDir}`);
    mkdirSync(logosDir, { recursive: true });
    return [];
  }

  const collator = new Intl.Collator('zh-CN');

  let logoFiles = readdirSync(logosDir).filter(
    f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.svg')
  );

  const logos = logoFiles.map(f => {
    const ext = extname(f);
    return { logo: f.slice(0, -ext.length), ext: ext.slice(1).toLowerCase() };
  });
  logos.sort((a, b) => collator.compare(a.logo, b.logo));

  console.log(`扫描到 ${logos.length} 个Logo`);
  return logos;
}

// --- 生成 ---

function generateLogoData(logos, publicDir) {
  /** 生成 public/logo_data.json */
  const jsonPath = join(publicDir, 'logo_data.json');
  writeFileSync(jsonPath, JSON.stringify(logos, null, 2), 'utf-8');
  console.log(`已生成: ${jsonPath} (${logos.length} 个Logo)`);
}

function convertCsvToJson(csvPaths, jsonPath, builtinFiles) {
  /** 读取多个 CSV 并生成 arts_data.json（含内置标记） */
  // 读取并合并所有 CSV 的记录
  let allRecords = [];
  let fieldnames = [];

  for (const csvPath of csvPaths) {
    if (!existsSync(csvPath)) {
      console.error(`CSV 文件不存在: ${csvPath}`);
      process.exit(1);
    }
    const text = readFileSync(csvPath, 'utf-8');
    const result = csvDictReader(text);
    if (fieldnames.length === 0) {
      fieldnames = result.fieldnames;
    }
    console.log(`读取 CSV: ${csvPath} (${result.records.length} 条记录)`);
    allRecords = allRecords.concat(result.records);
  }

  const requiredFields = ['角色名', '外文名', '性别', '立绘编号', '文件名', '文件链接', '势力logo', '出处'];
  const missing = requiredFields.filter(f => !fieldnames.includes(f));
  if (missing.length > 0) {
    console.error(`CSV 缺少必填列: ${JSON.stringify(missing)}`);
    process.exit(1);
  }

  const chars = {};
  const sourceStats = {};
  const charSource = {};

  for (const row of allRecords) {
    const name = row['角色名'];
    const source = row['出处'] || '';

    if (!(name in charSource)) {
      charSource[name] = source;
      if (source) {
        if (!(source in sourceStats)) {
          sourceStats[source] = { '角色数': 0, '立绘数': 0 };
        }
        sourceStats[source]['角色数'] += 1;
      }
    }

    if (!(name in chars)) {
      chars[name] = {
        '角色名': name,
        '外文名': row['外文名'] || '',
        '性别': row['性别'] || '',
        '立绘': [],
        'logo': row['势力logo'] || '',
        '出处': source,
        '信息': {},
      };
    }

    const portraitId = row['立绘编号'] || '';
    if (chars[name]['立绘'].some(p => p['编号'] === portraitId)) {
      console.log(`警告: 角色 ${name} 立绘编号 ${portraitId} 重复，已跳过`);
    } else {
      const filename = row['文件名'] || '';
      const isBuiltin = builtinFiles.has(filename);
      chars[name]['立绘'].push({
        '编号': portraitId,
        '文件名': filename,
        '文件链接': row['文件链接'] || '',
        '内置': isBuiltin,
        '时装品牌': row['时装品牌'] || '',
        '时装名': row['时装名'] || '',
      });
      if (source && source in sourceStats) {
        sourceStats[source]['立绘数'] += 1;
      }
    }

    const info = chars[name]['信息'];
    if (Object.keys(info).length === 0) {
      const infoFields = ['星级', '内部编号', '职业', '分支', '势力', '出身地', '上线时间'];
      for (const field of infoFields) {
        const val = (row[field] || '').trim();
        if (val) {
          if (field === '星级') {
            const num = parseInt(val, 10);
            info[field] = isNaN(num) ? val : num;
          } else {
            info[field] = val;
          }
        }
      }
    }
  }

  // 统计内置立绘数
  let builtinCount = 0;
  for (const c of Object.values(chars)) {
    for (const p of c['立绘']) {
      if (p['内置']) builtinCount++;
    }
  }
  console.log(`内置立绘标记完成: ${builtinCount} 张内置`);

  // 检查孤儿文件
  const referencedFiles = new Set();
  for (const c of Object.values(chars)) {
    for (const p of c['立绘']) {
      referencedFiles.add(p['文件名']);
    }
  }
  const orphans = [...builtinFiles].filter(f => !referencedFiles.has(f)).sort();
  if (orphans.length > 0) {
    console.log(`\n[!] 发现 ${orphans.length} 个孤儿文件（存在于 chararts/ 但未被 CSV 引用）:`);
    for (const f of orphans) {
      console.log(`  - ${f}`);
    }
  } else {
    console.log('无孤儿文件');
  }

  // 构建角色数数组
  const roleCountArray = [];
  const totalPortraits = Object.values(sourceStats).reduce((sum, s) => sum + s['立绘数'], 0);
  roleCountArray.push({
    '出处': '不限',
    '角色数': Object.keys(chars).length,
    '立绘数': totalPortraits,
  });
  for (const [source, stats] of Object.entries(sourceStats)) {
    roleCountArray.push({
      '出处': source,
      '角色数': stats['角色数'],
      '立绘数': stats['立绘数'],
    });
  }

  const outputData = {
    '元信息': {
      '转换时间': formatTimestamp(new Date()),
      '角色数': roleCountArray,
    },
    '角色': Object.values(chars),
  };

  writeFileSync(jsonPath, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`已生成: ${jsonPath} (${Object.keys(chars).length} 个角色, ${totalPortraits} 张立绘)`);
  console.log(`统计: ${JSON.stringify(roleCountArray)}`);
}

function formatTimestamp(date) {
  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${M}-${d} ${h}:${m}:${s}`;
}

// --- 主函数 ---

function main() {
  const projectRoot = findProjectRoot();
  const publicDir = join(projectRoot, 'public');
  const scriptsDir = join(projectRoot, 'scripts');

  const csvPaths = [
    join(scriptsDir, 'arts_data.csv'),
    join(scriptsDir, 'ark_chars.csv'),
  ];
  const jsonPath = join(publicDir, 'arts_data.json');

  for (const csvPath of csvPaths) {
    if (!existsSync(csvPath)) {
      console.error(`CSV 文件不存在: ${csvPath}`);
      process.exit(1);
    }
  }

  console.log(`项目根目录: ${projectRoot}`);
  console.log(`输出 JSON: ${jsonPath}`);
  console.log();

  // 0. 预先同步方舟干员数据
  if (SYNC_ARK_CHARS) {
    console.log('正在同步方舟干员数据...');
    try {
      execSync(`node ${join(scriptsDir, 'update_ark_chars.js')}`, { stdio: 'inherit', cwd: projectRoot });
    } catch (e) {
      console.error('同步方舟干员数据失败，继续使用已有数据:', e.message);
    }
    console.log();
  }

  // 1. 扫描内置立绘
  const builtinFiles = scanChararts(publicDir);

  // 2. 扫描 Logo，生成 logo_data.json
  const logos = scanLogos(publicDir);
  generateLogoData(logos, publicDir);

  // 3. 生成 arts_data.json（含内置标记）
  convertCsvToJson(csvPaths, jsonPath, builtinFiles);

  console.log();
  console.log('构建完成！');
}

main();
