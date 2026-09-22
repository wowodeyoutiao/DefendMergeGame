import math
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET


root_path = Path(__file__).resolve().parents[2]
workbook_path = root_path / 'outputs/balance-20260918/合战守格_产销与关卡调优.xlsx'
namespaces = {'sheet': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
formula_count = 0
missing_caches = []
errors = []

with zipfile.ZipFile(workbook_path) as archive:
    assert archive.testzip() is None
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    sheet_names = [entry.attrib['name'] for entry in workbook.findall('sheet:sheets/sheet:sheet', namespaces)]
    assert len(sheet_names) == 18
    assert not any('externalLinks' in name for name in archive.namelist())
    for name in archive.namelist():
        if not name.startswith('xl/worksheets/sheet') or not name.endswith('.xml'):
            continue
        worksheet = ET.fromstring(archive.read(name))
        for cell in worksheet.findall('.//sheet:c', namespaces):
            if cell.attrib.get('t') == 'e':
                errors.append((name, cell.attrib['r'], cell.findtext('sheet:v', namespaces=namespaces)))
            formula = cell.find('sheet:f', namespaces)
            if formula is not None:
                formula_count += 1
                cached = cell.find('sheet:v', namespaces)
                if cached is None:
                    missing_caches.append((name, cell.attrib['r']))
                elif cell.attrib.get('t', 'n') == 'n' and cached.text:
                    assert math.isfinite(float(cached.text))
    assert not errors, errors[:10]
    assert not missing_caches, missing_caches[:10]
    assert not any('/charts/' in name for name in archive.namelist())
    assert formula_count > 1000

print(f'Export verified: {len(sheet_names)} sheets, {formula_count} cached formulas, no formula errors or external links.')
print(f'File size: {workbook_path.stat().st_size:,} bytes')
