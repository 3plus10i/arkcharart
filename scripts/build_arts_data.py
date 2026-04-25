"""将 arts_data.csv 转换为 JSON 格式

CSV 表头: 角色名,外文名,性别,立绘编号,文件名,文件链接,logo,出处,星级,内部编号,职业,分支,势力,出身地
必有字段: 角色名,外文名,性别,立绘编号,文件名,文件链接,logo,出处
信息字段: 星级,内部编号,职业,分支,势力,出身地

输出 JSON 结构:
{
  "元信息": {
    "转换时间": "2026-04-25 19:32:00",
    "角色数": [
      { "出处": "不限", "角色数": 15, "立绘数": 50 },
      { "出处": "明日方舟", "角色数": 10, "立绘数": 35 },
      { "出处": "终末地", "角色数": 5, "立绘数": 15 }
    ]
  },
  "角色": [
    {
      "角色名": "...",
      "外文名": "...",
      "性别": "...",
      "立绘": [
        { "编号": "1", "文件名": "...", "文件链接": "..." },
        ...
      ],
      "logo": "...",
      "出处": "...",
      "信息": {
        "星级": 4,
        "内部编号": "...",
        ...
      }
    }
  ]
}
"""
import csv
import json
import sys
from datetime import datetime


def convert(csv_path, json_path):
    # 读取 CSV
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        # 校验必填列
        required_fields = ['角色名', '外文名', '性别', '立绘编号', '文件名', '文件链接', 'logo', '出处']
        missing = [f for f in required_fields if f not in reader.fieldnames]
        if missing:
            sys.exit(f"CSV 缺少必填列: {missing}")
        rows = list(reader)

    # 按角色名分组（内部用 dict，输出时转为列表）
    chars = {}
    # 统计各出处的角色数量和立绘数量
    source_stats = {}  # {出处: {角色数: x, 立绘数: y}}
    # 记录每个角色对应的出处（用于统计角色数）
    char_source = {}

    for row in rows:
        name = row['角色名']
        source = row.get('出处', '')

        # 记录角色的出处（仅首次）
        if name not in char_source:
            char_source[name] = source
            # 初始化该出处的统计
            if source:
                if source not in source_stats:
                    source_stats[source] = {'角色数': 0, '立绘数': 0}
                source_stats[source]['角色数'] += 1

        if name not in chars:
            chars[name] = {
                '角色名': name,
                '外文名': row.get('外文名', ''),
                '性别': row.get('性别', ''),
                '立绘': [],
                'logo': row.get('logo', ''),
                '出处': source,
                '信息': {},
            }

        # 添加立绘条目（跳过重复编号）
        portrait_id = row.get('立绘编号', '')
        if any(p['编号'] == portrait_id for p in chars[name]['立绘']):
            print(f"警告: 角色 {name} 立绘编号 {portrait_id} 重复，已跳过")
        else:
            chars[name]['立绘'].append({
                '编号': portrait_id,
                '文件名': row.get('文件名', ''),
                '文件链接': row.get('文件链接', ''),
            })
            # 统计立绘数
            if source and source in source_stats:
                source_stats[source]['立绘数'] += 1

        # 信息字段（仅首次写入，因为同一角色的信息相同）
        info = chars[name]['信息']
        if not info:
            info_fields = ['星级', '内部编号', '职业', '分支', '势力', '出身地']
            for field in info_fields:
                val = row.get(field, '').strip()
                if val:
                    if field == '星级':
                        try:
                            info[field] = int(val)
                        except ValueError:
                            info[field] = val
                    else:
                        info[field] = val

    # 构建角色数数组
    role_count_array = []
    # 先添加总计
    total_portraits = sum(stats['立绘数'] for stats in source_stats.values())
    role_count_array.append({
        '出处': '不限',
        '角色数': len(chars),
        '立绘数': total_portraits
    })
    # 添加各出处的统计
    for source, stats in source_stats.items():
        role_count_array.append({
            '出处': source,
            '角色数': stats['角色数'],
            '立绘数': stats['立绘数']
        })

    # 构建输出数据，包含元信息
    output_data = {
        '元信息': {
            '转换时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '角色数': role_count_array
        },
        '角色': list(chars.values())
    }

    # 写入 JSON（ensure_ascii=False 保留中文，indent=2 可读）
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"已转换 {len(chars)} 个角色，{total_portraits} 张立绘，保存到: {json_path}")
    print(f"统计信息: {role_count_array}")


if __name__ == '__main__':
    csv_file = sys.argv[1] if len(sys.argv) > 1 else 'arts_data.csv'
    json_file = sys.argv[2] if len(sys.argv) > 2 else 'arts_data.json'
    convert(csv_file, json_file)
