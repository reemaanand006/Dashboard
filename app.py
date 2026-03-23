from functools import wraps
from urllib.parse import urljoin, urlparse
from datetime import datetime
import os
import re
import secrets

from flask import Flask, flash, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash

from services.data_service import (
    add_service_record,
    calculate_dashboard_payload,
    delete_service_record,
    fetch_all_services,
    fetch_all_services_as_dict,
    fetch_service_by_id,
    get_data_version,
    init_db,
    update_service_record,
)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret-in-production")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
HYDERABAD_CITY = "Hyderabad, Telangana"
HYDERABAD_AREAS = [
    'Ameerpet',
    'Banjara Hills',
    'Begumpet',
    'Charminar',
    'Dilsukhnagar',
    'Gachibowli',
    'Hitec City',
    'Jubilee Hills',
    'Kondapur',
    'Kukatpally',
    'LB Nagar',
    'Madhapur',
    'Malakpet',
    'Mehdipatnam',
    'Miyapur',
    'Nampally',
    'Secunderabad',
    'Somajiguda',
    'Tarnaka',
    'Uppal',
]
HYDERABAD_AREA_SET = set(HYDERABAD_AREAS)
COMPLAINT_SERVICE_MAP = {
    'Health': ['Vaccination Drive', 'General Checkup', 'Emergency Response', 'Pharmacy Support', 'Blood Donation Camp'],
    'Transport': ['Bus Pass Issuance', 'License Renewal', 'Road Safety Audit', 'Vehicle Registration', 'Traffic Control'],
    'Finance': ['Tax Filing Support', 'Pension Disbursement', 'Loan Assistance', 'Budget Audit', 'Treasury Services'],
    'Public Works': ['Pothole Repair', 'Street Light Maintenance', 'Drainage Cleaning', 'Building Inspection', 'Park Maintenance'],
    'Education': ['Scholarship Disbursement', 'School Admission', 'Teacher Training', 'Library Services', 'Exam Conduct'],
    'Other': ['General Inquiry', 'Complaint Registration', 'Event Permission', 'Community Service'],
}

# Initialize DB on startup
init_db()


def is_safe_redirect_target(target):
    if not target:
        return False
    host_url = urlparse(request.host_url)
    redirect_url = urlparse(urljoin(request.host_url, target))
    return redirect_url.scheme in ("http", "https") and host_url.netloc == redirect_url.netloc


def is_admin_logged_in():
    return bool(session.get("is_admin"))


def verify_admin_password(password):
    if ADMIN_PASSWORD_HASH:
        return check_password_hash(ADMIN_PASSWORD_HASH, password)
    return secrets.compare_digest(password, ADMIN_PASSWORD)


def is_valid_email(email):
    return bool(EMAIL_RE.match(email))


def parse_date_or_none(value):
    if not value:
        return ''
    try:
        datetime.strptime(value, '%Y-%m-%d')
        return value
    except ValueError:
        return None


def admin_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not is_admin_logged_in():
            flash("Please log in as admin to continue.", "error")
            return redirect(url_for("login", next=request.path))
        return view_func(*args, **kwargs)

    return wrapped


def common_page_context(active_page):
    return {
        "active_page": active_page,
        "admin_username": session.get("admin_username", ADMIN_USERNAME),
        "is_admin": is_admin_logged_in(),
        "hyderabad_areas": HYDERABAD_AREAS,
        "complaint_service_map": COMPLAINT_SERVICE_MAP,
    }


@app.route('/')
def home():
    return render_template('pages/home.html', is_admin=is_admin_logged_in())


@app.route('/index')
def index_legacy():
    return redirect(url_for('dashboard'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if is_admin_logged_in():
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        legacy_username = request.form.get('username', '').strip().lower()
        password = request.form.get('password', '')

        login_identifier = email or legacy_username
        if not login_identifier:
            flash("Email is required.", "error")
            return render_template('pages/login.html')

        email_matches_legacy_username = secrets.compare_digest(login_identifier, ADMIN_USERNAME.lower())

        if not is_valid_email(login_identifier) and not email_matches_legacy_username:
            flash("Please enter a valid email address.", "error")
            return render_template('pages/login.html')

        email_matches_admin = secrets.compare_digest(login_identifier, ADMIN_EMAIL.lower())

        if (email_matches_admin or email_matches_legacy_username) and verify_admin_password(password):
            session.clear()
            session['is_admin'] = True
            session['admin_username'] = ADMIN_USERNAME
            session['admin_email'] = ADMIN_EMAIL
            flash("Admin login successful.", "success")

            next_url = request.args.get('next')
            if is_safe_redirect_target(next_url):
                return redirect(next_url)
            return redirect(url_for('dashboard'))

        flash("Invalid admin credentials.", "error")

    return render_template('pages/login.html')


@app.route('/logout', methods=['POST'])
@admin_required
def logout():
    session.clear()
    flash("Logged out successfully.", "success")
    return redirect(url_for('login'))


@app.route('/dashboard')
@admin_required
def dashboard():
    services = fetch_all_services()
    return render_template('pages/dashboard.html', services=services, **common_page_context('dashboard'))


@app.route('/records')
@admin_required
def records():
    services = fetch_all_services()
    return render_template('pages/records.html', services=services, **common_page_context('records'))


@app.route('/add-record', methods=['GET', 'POST'])
@admin_required
def add_record():
    if request.method == 'POST':
        department = request.form.get('category') or request.form.get('department', '')
        service = request.form.get('name') or request.form.get('service', '')
        status = request.form.get('status', 'In Progress')
        request_date = request.form.get('date', '')
        notes = request.form.get('notes', '').strip()
        city = request.form.get('city', HYDERABAD_CITY).strip() or HYDERABAD_CITY
        area = request.form.get('area', '').strip()
        landmark = request.form.get('landmark', '').strip()

        try:
            total_requests = int(request.form.get('total_requests', '0'))
            resolved_requests = int(request.form.get('resolved_requests', '0'))
            resolution_time = float(request.form.get('resolution_time', '0'))
            satisfaction = float(request.form.get('satisfaction', '0'))
        except ValueError:
            flash("Please enter valid numeric values for request metrics.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please enter valid numeric values for request metrics."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))

        allowed_categories = set(COMPLAINT_SERVICE_MAP.keys())
        allowed_statuses = {'Completed', 'In Progress', 'Pending', 'Blocked'}
        parsed_date = parse_date_or_none(request_date)
        allowed_services = COMPLAINT_SERVICE_MAP.get(department, [])

        if not service.strip():
            flash("Service name is required.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Service name is required."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if department not in allowed_categories:
            flash("Please select a valid category.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please select a valid category."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if service not in allowed_services:
            flash("Please select a valid service for the chosen category.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please select a valid service for the chosen category."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if status not in allowed_statuses:
            flash("Please select a valid status.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please select a valid status."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if city != HYDERABAD_CITY:
            flash("City is restricted to Hyderabad, Telangana.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "City is restricted to Hyderabad, Telangana."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if area not in HYDERABAD_AREA_SET:
            flash("Please select a valid Hyderabad area.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please select a valid Hyderabad area."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if parsed_date is None:
            flash("Please provide a valid date.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Please provide a valid date."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if total_requests < 0 or resolved_requests < 0 or resolution_time < 0:
            flash("Numeric values cannot be negative.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Numeric values cannot be negative."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if resolved_requests > total_requests:
            flash("Resolved requests cannot be greater than total requests.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Resolved requests cannot be greater than total requests."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))
        if satisfaction < 1 or satisfaction > 5:
            flash("Satisfaction must be between 1 and 5.", "error")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'message': "Satisfaction must be between 1 and 5."}), 400
            return render_template('pages/add_record.html', form_data=request.form, **common_page_context('add_record'))

        add_service_record(
            department,
            service,
            total_requests,
            resolved_requests,
            resolution_time,
            satisfaction,
            status,
            parsed_date or '',
            notes,
            city,
            area,
            landmark,
        )
        flash("Record added successfully.", "success")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': True, 'redirect': url_for('dashboard')})
        return redirect(url_for('dashboard'))

    return render_template('pages/add_record.html', form_data={}, **common_page_context('add_record'))


# Backward compatibility for old add endpoint
@app.route('/add', methods=['POST'])
@admin_required
def add_service_legacy():
    return add_record()


@app.route('/api/stats')
@admin_required
def get_stats():
    services = fetch_all_services()
    return jsonify(calculate_dashboard_payload(services))


@app.route('/api/records')
@admin_required
def get_records():
    return jsonify({'records': fetch_all_services_as_dict()})


@app.route('/api/data-version')
@admin_required
def data_version():
    return jsonify({'version': get_data_version()})


@app.route('/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def edit_service(id):
    service = fetch_service_by_id(id)
    if service is None:
        return "Record not found", 404

    if request.method == 'POST':
        department = request.form['department']
        service_name = request.form['service']
        total_requests = int(request.form['total_requests'])
        resolved_requests = int(request.form['resolved_requests'])
        resolution_time = float(request.form['resolution_time'])
        satisfaction = float(request.form['satisfaction'])

        update_service_record(
            id,
            department,
            service_name,
            total_requests,
            resolved_requests,
            resolution_time,
            satisfaction,
            request.form.get('status', service['status'] if 'status' in service.keys() else 'In Progress'),
            request.form.get('request_date', service['request_date'] if 'request_date' in service.keys() else ''),
            request.form.get('notes', service['notes'] if 'notes' in service.keys() else '').strip(),
            request.form.get('city', service['city'] if 'city' in service.keys() else HYDERABAD_CITY),
            request.form.get('area', service['area'] if 'area' in service.keys() else ''),
            request.form.get('landmark', service['landmark'] if 'landmark' in service.keys() else '').strip(),
        )
        flash("Record updated successfully.", "success")
        return redirect(url_for('records'))

    return render_template('edit.html', service=service)


@app.route('/delete/<int:id>', methods=['POST'])
@admin_required
def delete_service(id):
    delete_service_record(id)
    flash("Record deleted successfully.", "success")
    return redirect(url_for('records'))


if __name__ == '__main__':
    app.run(debug=True, port=5000)
