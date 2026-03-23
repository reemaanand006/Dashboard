import os
import sqlite3
from datetime import datetime

DB_NAME = os.getenv("DB_NAME", "service_data.db")

LEGACY_SERVICE_DEFAULTS = {
    'Vaccination Drive': {
        'area': 'Secunderabad',
        'landmark': 'Gandhi Hospital',
        'request_date': '2026-03-05',
        'status': 'Completed',
    },
    'Bus Pass Issuance': {
        'area': 'Ameerpet',
        'landmark': 'Ameerpet Metro Station',
        'request_date': '2026-03-07',
        'status': 'In Progress',
    },
    'Tax Filing Support': {
        'area': 'Nampally',
        'landmark': 'Income Tax Towers',
        'request_date': '2026-03-09',
        'status': 'In Progress',
    },
    'Pothole Repair': {
        'area': 'Kukatpally',
        'landmark': 'JNTU Junction',
        'request_date': '2026-03-11',
        'status': 'Blocked',
    },
    'Scholarship Disbursement': {
        'area': 'Tarnaka',
        'landmark': 'District Education Office',
        'request_date': '2026-03-13',
        'status': 'Completed',
    },
    'Blood Donation Camp': {
        'area': 'Begumpet',
        'landmark': 'Prakash Nagar Community Hall',
        'request_date': '2026-03-14',
        'status': 'In Progress',
    },
}

PRECISE_SAMPLE_RECORDS = [
    {
        'department': 'Public Works',
        'service': 'Storm Water Drain Cleaning',
        'total_requests': 265,
        'resolved_requests': 214,
        'resolution_time': 19.5,
        'satisfaction': 4.1,
        'status': 'In Progress',
        'request_date': '2026-03-15',
        'notes': 'Pre-monsoon preventive cleaning schedule',
        'city': 'Hyderabad, Telangana',
        'area': 'Somajiguda',
        'landmark': 'Raj Bhavan Road Junction',
    },
    {
        'department': 'Transport',
        'service': 'Traffic Signal Sync Upgrade',
        'total_requests': 148,
        'resolved_requests': 136,
        'resolution_time': 8.5,
        'satisfaction': 4.4,
        'status': 'Completed',
        'request_date': '2026-03-16',
        'notes': 'Peak-hour optimization at major intersections',
        'city': 'Hyderabad, Telangana',
        'area': 'Madhapur',
        'landmark': 'Cyber Towers Junction',
    },
    {
        'department': 'Health',
        'service': 'Urban PHC Telemedicine Support',
        'total_requests': 192,
        'resolved_requests': 165,
        'resolution_time': 10.2,
        'satisfaction': 4.6,
        'status': 'In Progress',
        'request_date': '2026-03-17',
        'notes': 'Follow-up consults for chronic care patients',
        'city': 'Hyderabad, Telangana',
        'area': 'Mehdipatnam',
        'landmark': 'Pillar No. 124 Bus Bay',
    },
    {
        'department': 'Finance',
        'service': 'Property Tax Grievance Resolution',
        'total_requests': 174,
        'resolved_requests': 121,
        'resolution_time': 22.0,
        'satisfaction': 3.8,
        'status': 'Pending',
        'request_date': '2026-03-18',
        'notes': 'Backlog due to reassessment document verification',
        'city': 'Hyderabad, Telangana',
        'area': 'LB Nagar',
        'landmark': 'GHMC Circle Office',
    },
    {
        'department': 'Education',
        'service': 'Digital Classroom Network Support',
        'total_requests': 132,
        'resolved_requests': 119,
        'resolution_time': 11.0,
        'satisfaction': 4.5,
        'status': 'Completed',
        'request_date': '2026-03-19',
        'notes': 'Infrastructure uptime validation completed',
        'city': 'Hyderabad, Telangana',
        'area': 'Uppal',
        'landmark': 'Survey of India Campus Road',
    },
]


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db_exists = os.path.exists(DB_NAME)
    conn = get_db_connection()
    with conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS service_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                department TEXT NOT NULL,
                service TEXT NOT NULL,
                total_requests INTEGER NOT NULL,
                resolved_requests INTEGER NOT NULL,
                resolution_time REAL NOT NULL,
                satisfaction REAL NOT NULL,
                status TEXT DEFAULT 'In Progress',
                request_date TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                city TEXT DEFAULT 'Hyderabad, Telangana',
                area TEXT DEFAULT '',
                landmark TEXT DEFAULT ''
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            '''
        )
        conn.execute(
            '''
            INSERT OR IGNORE INTO app_meta (key, value) VALUES ('data_version', '1')
            '''
        )
        ensure_schema(conn)

        if not db_exists:
            conn.execute(
                '''
                INSERT INTO service_data (department, service, total_requests, resolved_requests, resolution_time, satisfaction, status, request_date, notes, city, area, landmark)
                VALUES
                ('Health', 'Vaccination Drive', 1200, 1150, 24.5, 4.8, 'Completed', '2026-03-05', 'Routine drive', 'Hyderabad, Telangana', 'Banjara Hills', 'City Health Center'),
                ('Transport', 'Bus Pass Issuance', 500, 480, 48.0, 4.2, 'In Progress', '2026-03-07', 'High walk-in volume', 'Hyderabad, Telangana', 'Ameerpet', 'Metro Hub'),
                ('Finance', 'Tax Filing Support', 800, 600, 72.0, 3.5, 'In Progress', '2026-03-09', 'Pending document verification', 'Hyderabad, Telangana', 'Secunderabad', 'Revenue Office'),
                ('Public Works', 'Pothole Repair', 300, 150, 120.0, 2.9, 'Blocked', '2026-03-11', 'Weather-related delay', 'Hyderabad, Telangana', 'Kukatpally', 'JNTU Junction'),
                ('Education', 'Scholarship Disbursement', 600, 590, 12.0, 4.9, 'Completed', '2026-03-13', 'Batch closure complete', 'Hyderabad, Telangana', 'Tarnaka', 'District Education Office')
                '''
            )
        if ensure_precise_sample_data(conn):
            bump_data_version(conn)
    conn.close()


def ensure_schema(conn):
    columns = {row['name'] for row in conn.execute("PRAGMA table_info(service_data)").fetchall()}
    if 'status' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN status TEXT DEFAULT 'In Progress'")
    if 'request_date' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN request_date TEXT DEFAULT ''")
    if 'notes' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN notes TEXT DEFAULT ''")
    if 'city' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN city TEXT DEFAULT 'Hyderabad, Telangana'")
    if 'area' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN area TEXT DEFAULT ''")
    if 'landmark' not in columns:
        conn.execute("ALTER TABLE service_data ADD COLUMN landmark TEXT DEFAULT ''")


def ensure_precise_sample_data(conn):
    changed = False
    fallback_date = datetime.now().strftime('%Y-%m-%d')

    for service_name, defaults in LEGACY_SERVICE_DEFAULTS.items():
        result = conn.execute(
            '''
            UPDATE service_data
            SET
                city = CASE WHEN city IS NULL OR city = '' THEN 'Hyderabad, Telangana' ELSE city END,
                area = CASE WHEN area IS NULL OR area = '' THEN ? ELSE area END,
                landmark = CASE WHEN landmark IS NULL OR landmark = '' THEN ? ELSE landmark END,
                request_date = CASE WHEN request_date IS NULL OR request_date = '' THEN ? ELSE request_date END,
                status = CASE WHEN status IS NULL OR status = '' THEN ? ELSE status END
            WHERE service = ?
            ''',
            (
                defaults['area'],
                defaults['landmark'],
                defaults['request_date'],
                defaults['status'],
                service_name,
            ),
        )
        if result.rowcount > 0:
            changed = True

    fallback_update = conn.execute(
        '''
        UPDATE service_data
        SET
            city = CASE WHEN city IS NULL OR city = '' THEN 'Hyderabad, Telangana' ELSE city END,
            area = CASE WHEN area IS NULL OR area = '' THEN 'Somajiguda' ELSE area END,
            landmark = CASE WHEN landmark IS NULL OR landmark = '' THEN 'Integrated Command Control Center' ELSE landmark END,
            request_date = CASE WHEN request_date IS NULL OR request_date = '' THEN ? ELSE request_date END,
            status = CASE WHEN status IS NULL OR status = '' THEN 'In Progress' ELSE status END
        WHERE
            area IS NULL OR area = '' OR
            city IS NULL OR city = '' OR
            landmark IS NULL OR landmark = '' OR
            request_date IS NULL OR request_date = '' OR
            status IS NULL OR status = ''
        ''',
        (fallback_date,),
    )
    if fallback_update.rowcount > 0:
        changed = True

    for record in PRECISE_SAMPLE_RECORDS:
        exists = conn.execute(
            '''
            SELECT 1
            FROM service_data
            WHERE service = ? AND request_date = ? AND area = ?
            LIMIT 1
            ''',
            (record['service'], record['request_date'], record['area']),
        ).fetchone()
        if exists:
            continue

        conn.execute(
            '''
            INSERT INTO service_data
            (department, service, total_requests, resolved_requests, resolution_time, satisfaction, status, request_date, notes, city, area, landmark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                record['department'],
                record['service'],
                record['total_requests'],
                record['resolved_requests'],
                record['resolution_time'],
                record['satisfaction'],
                record['status'],
                record['request_date'],
                record['notes'],
                record['city'],
                record['area'],
                record['landmark'],
            ),
        )
        changed = True

    return changed

def bump_data_version(conn):
    conn.execute(
        '''
        UPDATE app_meta
        SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
        WHERE key = 'data_version'
        '''
    )


def get_data_version():
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM app_meta WHERE key = 'data_version'").fetchone()
    conn.close()
    if not row:
        return 1
    try:
        return int(row['value'])
    except (TypeError, ValueError):
        return 1


def fetch_all_services_as_dict():
    return [dict(row) for row in fetch_all_services()]


def fetch_all_services():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM service_data ORDER BY id DESC').fetchall()
    conn.close()
    return rows


def fetch_service_by_id(service_id):
    conn = get_db_connection()
    row = conn.execute('SELECT * FROM service_data WHERE id = ?', (service_id,)).fetchone()
    conn.close()
    return row


def add_service_record(
    department,
    service,
    total_requests,
    resolved_requests,
    resolution_time,
    satisfaction,
    status='In Progress',
    request_date='',
    notes='',
    city='Hyderabad, Telangana',
    area='',
    landmark='',
):
    conn = get_db_connection()
    with conn:
        conn.execute(
            '''
            INSERT INTO service_data (department, service, total_requests, resolved_requests, resolution_time, satisfaction, status, request_date, notes, city, area, landmark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (department, service, total_requests, resolved_requests, resolution_time, satisfaction, status, request_date, notes, city, area, landmark),
        )
        bump_data_version(conn)
    conn.close()


def update_service_record(
    service_id,
    department,
    service,
    total_requests,
    resolved_requests,
    resolution_time,
    satisfaction,
    status='In Progress',
    request_date='',
    notes='',
    city='Hyderabad, Telangana',
    area='',
    landmark='',
):
    conn = get_db_connection()
    with conn:
        conn.execute(
            '''
            UPDATE service_data
            SET department = ?, service = ?, total_requests = ?, resolved_requests = ?, resolution_time = ?, satisfaction = ?, status = ?, request_date = ?, notes = ?, city = ?, area = ?, landmark = ?
            WHERE id = ?
            ''',
            (department, service, total_requests, resolved_requests, resolution_time, satisfaction, status, request_date, notes, city, area, landmark, service_id),
        )
        bump_data_version(conn)
    conn.close()


def delete_service_record(service_id):
    conn = get_db_connection()
    with conn:
        conn.execute('DELETE FROM service_data WHERE id = ?', (service_id,))
        bump_data_version(conn)
    conn.close()


def calculate_dashboard_payload(services):
    total_entries = len(services)
    total_requests = sum(s['total_requests'] for s in services)
    total_resolved = sum(s['resolved_requests'] for s in services)
    avg_satisfaction = round(sum(s['satisfaction'] for s in services) / total_entries, 2) if total_entries > 0 else 0
    avg_resolution_time = round(sum(s['resolution_time'] for s in services) / total_entries, 1) if total_entries > 0 else 0
    overall_efficiency = round((total_resolved / total_requests) * 100, 1) if total_requests > 0 else 0

    dept_counts = {}
    area_distribution = {}
    dept_efficiency = {}
    service_data = []
    critical_alerts = []

    for s in services:
        dept = s['department']
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
        area_name = s['area'] if s['area'] else 'Unspecified'
        area_distribution[area_name] = area_distribution.get(area_name, 0) + 1

        if dept not in dept_efficiency:
            dept_efficiency[dept] = [0, 0]
        dept_efficiency[dept][0] += s['resolved_requests']
        dept_efficiency[dept][1] += s['total_requests']

        eff = round((s['resolved_requests'] / s['total_requests']) * 100, 1) if s['total_requests'] > 0 else 0
        service_data.append({
            'name': s['service'],
            'department': s['department'],
            'requests': s['total_requests'],
            'resolved': s['resolved_requests'],
            'efficiency': eff,
            'satisfaction': s['satisfaction'],
            'time': s['resolution_time'],
        })

        if s['satisfaction'] < 3.0:
            critical_alerts.append(f"Low Satisfaction: {s['service']} ({s['satisfaction']})")
        if s['resolution_time'] > 72.0:
            critical_alerts.append(f"High Resolution Time: {s['service']} ({s['resolution_time']}h)")
        if eff < 50.0:
            critical_alerts.append(f"Low Efficiency: {s['service']} ({eff}%)")

    dept_eff_final = {}
    for dept, counts in dept_efficiency.items():
        dept_eff_final[dept] = round((counts[0] / counts[1]) * 100, 1) if counts[1] > 0 else 0

    # Synthetic month-series based on live totals to provide a trend view even without date-stamped rows.
    month_labels = []
    monthly_requests = []
    monthly_completed = []
    month_weights = [0.72, 0.8, 0.84, 0.9, 0.96, 1.0]
    current_date = datetime.now()

    for idx, weight in enumerate(month_weights):
        month_number = current_date.month - (len(month_weights) - 1 - idx)
        year = current_date.year
        while month_number <= 0:
            month_number += 12
            year -= 1
        month_labels.append(datetime(year, month_number, 1).strftime('%b'))
        monthly_requests.append(max(0, int(round(total_requests * weight / max(1, len(month_weights))))))
        monthly_completed.append(max(0, int(round(total_resolved * weight / max(1, len(month_weights))))))

    return {
        'kpi': {
            'total_services': total_entries,
            'total_requests': total_requests,
            'total_resolved': total_resolved,
            'avg_satisfaction': avg_satisfaction,
            'avg_resolution_time': avg_resolution_time,
            'overall_efficiency': overall_efficiency,
            'critical_alerts': critical_alerts,
        },
        'charts': {
            'departments': dept_counts,
            'dept_efficiency': dept_eff_final,
            'services': service_data,
            'category_distribution': dept_counts,
            'area_distribution': area_distribution,
            'monthly_trends': {
                'labels': month_labels,
                'requests': monthly_requests,
                'completed': monthly_completed,
            },
        },
    }
