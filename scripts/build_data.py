"""统一构建脚本：生成 arts_data.json 和 logo.js

功能：
1. 读取 scripts/arts_data.csv
2. 扫描 public/chararts/，给立绘条目标记 内置: true/false
3. 扫描 public/logos/，生成 logo.js
4. 生成 public/arts_data.json
"""

import csv
import json
import locale
import os
import sys
from datetime import datetime

# 初始化中文排序环境
if sys.platform == 'win32':
    try:
        locale.setlocale(locale.LC_COLLATE, 'chinese')
    except locale.Error:
        pass
else:
    try:
        locale.setlocale(locale.LC_COLLATE, 'zh_CN.UTF-8')
    except locale.Error:
        pass


def find_project_root():
    """从脚本所在目录向上查找项目根目录（包含 public/ 的目录）"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidate = script_dir
    for _ in range(3):
        if os.path.isdir(os.path.join(candidate, 'public')):
            return candidate
        candidate = os.path.dirname(candidate)
    # 回退：假设脚本在 scripts/ 下，项目根是其父目录
    return os.path.dirname(script_dir)


def scan_chararts(public_dir):
    """扫描 public/chararts/，返回内置立绘文件名集合"""
    chararts_dir = os.path.join(public_dir, 'chararts')
    if not os.path.isdir(chararts_dir):
        print(f"警告: chararts 目录不存在: {chararts_dir}")
        os.makedirs(chararts_dir, exist_ok=True)
        return set()
    files = {f for f in os.listdir(chararts_dir) if f.lower().endswith('.png')}
    print(f"扫描到 {len(files)} 个内置立绘文件")
    return files


def scan_logos(public_dir):
    """扫描 public/logos/，返回 logo 列表和扩展名映射"""
    logos_dir = os.path.join(public_dir, 'logos')
    if not os.path.isdir(logos_dir):
        print(f"警告: logos 目录不存在: {logos_dir}")
        os.makedirs(logos_dir, exist_ok=True)
        return [], {}

    logo_files = sorted(
        f for f in os.listdir(logos_dir)
        if f.lower().endswith('.png') or f.lower().endswith('.svg')
    )

    logo_list = [os.path.splitext(f)[0] for f in logo_files]
    # 按中文拼音排序
    logo_list.sort(key=locale.strxfrm)

    logo_ext_map = {}
    for f in logo_files:
        name, ext = os.path.splitext(f)
        logo_ext_map[name] = ext.lstrip('.').lower()

    print(f"扫描到 {len(logo_list)} 个Logo")
    return logo_list, logo_ext_map


def generate_logo_js(logo_list, logo_ext_map, src_data_dir):
    """生成 src/data/logo.js"""
    content = f"""// 自动生成的logo文件列表（logo名=文件名，不含后缀）

export const logos = {json.dumps(logo_list, ensure_ascii=False, indent=2)}

// logo名→文件扩展名映射（用于构建logo路径时判断.png/.svg）
export const logoExtMap = {json.dumps(logo_ext_map, ensure_ascii=False, indent=2)}
"""
    os.makedirs(src_data_dir, exist_ok=True)
    js_path = os.path.join(src_data_dir, 'logo.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"已生成: {js_path} ({len(logo_list)} 个Logo)")


def convert_csv_to_json(csv_path, json_path, builtin_files):
    """读取 CSV 并生成 arts_data.json（含内置标记）"""
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        required_fields = ['角色名', '外文名', '性别', '立绘编号', '文件名', '文件链接', 'logo', '出处']
        missing = [field for field in required_fields if field not in reader.fieldnames]
        if missing:
            sys.exit(f"CSV 缺少必填列: {missing}")
        rows = list(reader)

    chars = {}
    source_stats = {}
    char_source = {}

    for row in rows:
        name = row['角色名']
        source = row.get('出处', '')

        if name not in char_source:
            char_source[name] = source
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

        portrait_id = row.get('立绘编号', '')
        if any(p['编号'] == portrait_id for p in chars[name]['立绘']):
            print(f"警告: 角色 {name} 立绘编号 {portrait_id} 重复，已跳过")
        else:
            filename = row.get('文件名', '')
            is_builtin = filename in builtin_files
            chars[name]['立绘'].append({
                '编号': portrait_id,
                '文件名': filename,
                '文件链接': row.get('文件链接', ''),
                '内置': is_builtin,
            })
            if source and source in source_stats:
                source_stats[source]['立绘数'] += 1

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

    # 统计内置立绘数
    builtin_count = sum(
        1 for c in chars.values() for p in c['立绘'] if p.get('内置')
    )
    print(f"内置立绘标记完成: {builtin_count} 张内置")

    # 检查孤儿文件：存在于 chararts/ 但未被任何 CSV 记录引用
    referenced_files = {p['文件名'] for c in chars.values() for p in c['立绘']}
    orphans = sorted(builtin_files - referenced_files)
    if orphans:
        print(f"\n[!] 发现 {len(orphans)} 个孤儿文件（存在于 chararts/ 但未被 CSV 引用）:")
        for f in orphans:
            print(f"  - {f}")
    else:
        print("无孤儿文件")

    # 构建角色数数组
    role_count_array = []
    total_portraits = sum(stats['立绘数'] for stats in source_stats.values())
    role_count_array.append({
        '出处': '不限',
        '角色数': len(chars),
        '立绘数': total_portraits
    })
    for source, stats in source_stats.items():
        role_count_array.append({
            '出处': source,
            '角色数': stats['角色数'],
            '立绘数': stats['立绘数']
        })

    output_data = {
        '元信息': {
            '转换时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '角色数': role_count_array
        },
        '角色': list(chars.values())
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"已生成: {json_path} ({len(chars)} 个角色, {total_portraits} 张立绘)")
    print(f"统计: {role_count_array}")


def main():
    project_root = find_project_root()
    public_dir = os.path.join(project_root, 'public')
    src_data_dir = os.path.join(project_root, 'src', 'data')
    scripts_dir = os.path.join(project_root, 'scripts')

    csv_path = os.path.join(scripts_dir, 'arts_data.csv')
    json_path = os.path.join(public_dir, 'arts_data.json')

    if not os.path.isfile(csv_path):
        sys.exit(f"CSV 文件不存在: {csv_path}")

    print(f"项目根目录: {project_root}")
    print(f"读取 CSV: {csv_path}")
    print(f"输出 JSON: {json_path}")
    print()

    # 1. 扫描内置立绘
    builtin_files = scan_chararts(public_dir)

    # 2. 扫描 Logo，生成 logo.js
    logo_list, logo_ext_map = scan_logos(public_dir)
    generate_logo_js(logo_list, logo_ext_map, src_data_dir)

    # 3. 生成 arts_data.json（含内置标记）
    convert_csv_to_json(csv_path, json_path, builtin_files)

    print()
    print("构建完成！")


if __name__ == '__main__':
    main()
