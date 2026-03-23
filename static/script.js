// Global Service Map
const serviceMap = {
    'Health': ['Vaccination Drive', 'General Checkup', 'Emergency Response', 'Pharmacy Support', 'Blood Donation Camp'],
    'Transport': ['Bus Pass Issuance', 'License Renewal', 'Road Safety Audit', 'Vehicle Registration', 'Traffic Control'],
    'Finance': ['Tax Filing Support', 'Pension Disbursement', 'Loan Assistance', 'Budget Audit', 'Treasury Services'],
    'Public Works': ['Pothole Repair', 'Street Light Maintenance', 'Drainage Cleaning', 'Building Inspection', 'Park Maintenance'],
    'Education': ['Scholarship Disbursement', 'School Admission', 'Teacher Training', 'Library Services', 'Exam Conduct'],
    'Other': ['General Inquiry', 'Complaint Registration', 'Event Permission', 'Community Service']
};

function populateServiceOptions(categorySelect, serviceSelect, preselected = '') {
    if (!categorySelect || !serviceSelect) return;

    const selectedCategory = categorySelect.value;
    const selectedService = preselected || serviceSelect.dataset.preselect || '';
    serviceSelect.innerHTML = '<option value="" disabled selected>Select Service</option>';

    if (selectedCategory && serviceMap[selectedCategory]) {
        serviceMap[selectedCategory].forEach((service) => {
            const option = document.createElement('option');
            option.value = service;
            option.text = service;
            if (selectedService && selectedService === service) {
                option.selected = true;
            }
            serviceSelect.appendChild(option);
        });
    }
}

function animateCount(el, target, suffix = '') {
    if (!el) return;
    const start = Number(el.dataset.lastValue || 0);
    const end = Number(target || 0);
    const duration = 800;
    const startTime = performance.now();

    const frame = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        el.innerText = `${current.toLocaleString()}${suffix}`;
        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            el.dataset.lastValue = String(end);
        }
    };

    requestAnimationFrame(frame);
}

function updateServices() {
    const deptSelect = document.getElementById('deptSelect');
    const serviceSelect = document.getElementById('serviceSelect');
    if (!deptSelect || !serviceSelect) return;
    populateServiceOptions(deptSelect, serviceSelect);
}

document.addEventListener('DOMContentLoaded', () => {
    const cssVars = getComputedStyle(document.documentElement);
    const cssColor = (name, fallback) => cssVars.getPropertyValue(name).trim() || fallback;

    const palette = {
        primary: cssColor('--primary', '#1d4ed8'),
        primaryLight: cssColor('--primary-light', 'rgba(29, 78, 216, 0.16)'),
        secondary: cssColor('--secondary', '#334155'),
        textMain: cssColor('--text-main', '#0f172a'),
        border: cssColor('--border', '#cbd5e1'),
        success: cssColor('--success', '#10b981'),
        warning: cssColor('--warning', '#f59e0b'),
        danger: cssColor('--danger', '#ef4444'),
        info: cssColor('--info', '#0284c7'),
    };
    let dashboardRefreshFn = null;
    let recordsRefreshFn = null;
    const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('city-analytics-sync') : null;

    function emitDataChanged() {
        const ts = Date.now();
        try {
            localStorage.setItem('city_analytics_data_changed', String(ts));
        } catch (e) {
            // Ignore storage errors (private mode/quota)
        }
        syncChannel?.postMessage({ type: 'DATA_CHANGED', ts });
    }

    function setupSidebarNavigation() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const body = document.body;
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        const storageKey = 'dashboard_sidebar_collapsed';

        const setCollapsed = (collapsed) => {
            body.classList.toggle('sidebar-collapsed', collapsed);
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-pressed', String(collapsed));
                toggleBtn.title = collapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
            }
        };

        const stored = localStorage.getItem(storageKey);
        if (stored === '1') {
            setCollapsed(true);
        }

        toggleBtn?.addEventListener('click', () => {
            const collapsed = !body.classList.contains('sidebar-collapsed');
            setCollapsed(collapsed);
            localStorage.setItem(storageKey, collapsed ? '1' : '0');
        });

        const path = window.location.pathname;
        document.querySelectorAll('.sidebar .nav-item[data-nav-route]').forEach((item) => {
            const route = item.getAttribute('data-nav-route');
            if (route && path.startsWith(route)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function setupLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const submitBtn = document.getElementById('loginSubmitBtn');
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const setError = (el, message) => {
            if (el) el.textContent = message || '';
        };

        const validate = () => {
            let valid = true;
            const email = (emailInput?.value || '').trim();
            const password = passwordInput?.value || '';

            if (!email) {
                setError(emailError, 'Email is required.');
                valid = false;
            } else if (!emailPattern.test(email)) {
                setError(emailError, 'Enter a valid email address.');
                valid = false;
            } else {
                setError(emailError, '');
            }

            if (!password) {
                setError(passwordError, 'Password is required.');
                valid = false;
            } else {
                setError(passwordError, '');
            }

            return valid;
        };

        emailInput?.addEventListener('input', () => setError(emailError, ''));
        passwordInput?.addEventListener('input', () => setError(passwordError, ''));

        form.addEventListener('submit', (e) => {
            if (!validate()) {
                e.preventDefault();
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('is-loading');
                submitBtn.setAttribute('aria-busy', 'true');
            }
        });
    }

    function setupAddRecordForm() {
        const form = document.getElementById('addRecordForm');
        if (!form) return;

        const fields = {
            service: document.getElementById('recordService'),
            category: document.getElementById('recordCategory'),
            status: document.getElementById('recordStatus'),
            area: document.getElementById('recordArea'),
            date: document.getElementById('recordDate'),
            total: document.getElementById('recordTotal'),
            resolved: document.getElementById('recordResolved'),
            time: document.getElementById('recordTime'),
            satisfaction: document.getElementById('recordSatisfaction'),
        };

        const errors = {
            service: document.getElementById('serviceError'),
            category: document.getElementById('categoryError'),
            status: document.getElementById('statusError'),
            area: document.getElementById('areaError'),
            date: document.getElementById('dateError'),
            total: document.getElementById('totalError'),
            resolved: document.getElementById('resolvedError'),
            time: document.getElementById('timeError'),
            satisfaction: document.getElementById('satisfactionError'),
        };

        const submitBtn = document.getElementById('addRecordSubmitBtn');
        const submitLabel = submitBtn?.querySelector('.add-record-btn-text');

        const setError = (key, message) => {
            if (errors[key]) errors[key].textContent = message || '';
        };

        const clearAllErrors = () => {
            Object.keys(errors).forEach((key) => setError(key, ''));
        };

        const validate = () => {
            clearAllErrors();
            let valid = true;

            const service = (fields.service?.value || '').trim();
            const category = fields.category?.value || '';
            const status = fields.status?.value || '';
            const area = fields.area?.value || '';
            const date = fields.date?.value || '';
            const total = Number(fields.total?.value || 0);
            const resolved = Number(fields.resolved?.value || 0);
            const time = Number(fields.time?.value || 0);
            const satisfaction = Number(fields.satisfaction?.value || 0);

            if (!service) {
                setError('service', 'Please select a service.');
                valid = false;
            }
            if (!category) {
                setError('category', 'Please select a category.');
                valid = false;
            }
            if (!status) {
                setError('status', 'Please select a status.');
                valid = false;
            }
            if (!area) {
                setError('area', 'Please select an area.');
                valid = false;
            }
            if (!date) {
                setError('date', 'Please provide a date.');
                valid = false;
            }
            if (total < 0) {
                setError('total', 'Total requests cannot be negative.');
                valid = false;
            }
            if (resolved < 0) {
                setError('resolved', 'Resolved requests cannot be negative.');
                valid = false;
            }
            if (resolved > total) {
                setError('resolved', 'Resolved requests cannot exceed total.');
                valid = false;
            }
            if (time < 0) {
                setError('time', 'Resolution time cannot be negative.');
                valid = false;
            }
            if (satisfaction < 1 || satisfaction > 5) {
                setError('satisfaction', 'Satisfaction must be between 1 and 5.');
                valid = false;
            }

            return valid;
        };

        Object.values(fields).forEach((input) => {
            input?.addEventListener('input', clearAllErrors);
            input?.addEventListener('change', clearAllErrors);
        });

        if (fields.category && fields.service) {
            const preselectedService = fields.service.dataset.preselect || fields.service.value || '';
            populateServiceOptions(fields.category, fields.service, preselectedService);
            fields.category.addEventListener('change', () => {
                fields.service.dataset.preselect = '';
                populateServiceOptions(fields.category, fields.service);
                setError('service', '');
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validate()) {
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('is-loading');
                submitBtn.setAttribute('aria-busy', 'true');
            }

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    body: new FormData(form),
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok || payload.success === false) {
                    setError('service', payload.message || 'Unable to submit record. Please check your input.');
                    throw new Error(payload.message || 'Submit failed');
                }

                emitDataChanged();
                if (submitLabel) submitLabel.textContent = 'Saved';
                window.location.href = payload.redirect || '/dashboard';
            } catch (error) {
                console.error(error);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('is-loading');
                    submitBtn.removeAttribute('aria-busy');
                }
                if (submitLabel) submitLabel.textContent = 'Save Record';
            }
        });
    }

    function setupHomeMicroInteractions() {
        if (!document.body.classList.contains('home-page')) return;

        document.querySelectorAll('.home-page .btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                btn.classList.remove('click-pop');
                void btn.offsetWidth;
                btn.classList.add('click-pop');
                setTimeout(() => btn.classList.remove('click-pop'), 230);
            });
        });
    }

    function setupPageTransitions() {
        requestAnimationFrame(() => document.body.classList.add('page-ready'));

        const transitionOut = (navigate) => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                navigate();
                return;
            }
            document.body.classList.add('page-leaving');
            setTimeout(navigate, 180);
        };

        document.querySelectorAll('a[href]').forEach((link) => {
            link.addEventListener('click', (e) => {
                if (
                    e.defaultPrevented ||
                    e.button !== 0 ||
                    link.target === '_blank' ||
                    link.hasAttribute('download')
                ) return;

                const rawHref = link.getAttribute('href') || '';
                if (
                    rawHref.startsWith('#') ||
                    rawHref.startsWith('javascript:') ||
                    rawHref.startsWith('mailto:') ||
                    rawHref.startsWith('tel:')
                ) return;

                const url = new URL(link.href, window.location.href);
                if (url.origin !== window.location.origin) return;
                if (url.href === window.location.href) return;

                e.preventDefault();
                transitionOut(() => {
                    window.location.href = url.href;
                });
            });
        });

        document.querySelectorAll('form').forEach((form) => {
            form.addEventListener('submit', (e) => {
                if (e.defaultPrevented || form.dataset.noTransition === 'true') return;
                transitionOut(() => form.submit());
                e.preventDefault();
            });
        });
    }

    function setupRevealAnimations() {
        const revealTargets = document.querySelectorAll('.kpi-card, .card, .alert-banner, .content-header');
        revealTargets.forEach((el, index) => {
            el.classList.add('reveal');
            el.style.transitionDelay = `${Math.min(index * 45, 280)}ms`;
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealTargets.forEach((el) => observer.observe(el));
    }

    function initRecordsTable() {
        const tableBody = document.getElementById('recordsTableBody');
        if (!tableBody) return;

        let allRows = Array.from(tableBody.querySelectorAll('tr'));
        if (allRows.length === 0) return;

        const searchInput = document.getElementById('recordsSearch');
        const filterCategory = document.getElementById('filterCategory');
        const filterArea = document.getElementById('filterArea');
        const filterStatus = document.getElementById('filterStatus');
        const filterDateFrom = document.getElementById('filterDateFrom');
        const filterDateTo = document.getElementById('filterDateTo');
        const clearBtn = document.getElementById('clearRecordFilters');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInfo = document.getElementById('pageInfo');
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        const countLabel = document.getElementById('recordsCountLabel');
        const noRecordsMessage = document.getElementById('noRecordsMessage');
        const isAdmin = true;

        let currentPage = 1;
        let pageSize = Number(pageSizeSelect?.value || 10);
        let filteredRows = allRows;

        const normalize = (v) => (v || '').toString().trim().toLowerCase();

        const applyFilters = () => {
            const query = normalize(searchInput?.value);
            const selectedCategory = normalize(filterCategory?.value);
            const selectedArea = normalize(filterArea?.value);
            const selectedStatus = normalize(filterStatus?.value);
            const fromDate = filterDateFrom?.value || '';
            const toDate = filterDateTo?.value || '';

            filteredRows = allRows.filter((row) => {
                const rowText = normalize(row.innerText);
                const category = normalize(row.dataset.category);
                const status = normalize(row.dataset.status);
                const area = normalize(row.dataset.area);
                const date = row.dataset.date || '';

                const matchesSearch = !query || rowText.includes(query);
                const matchesCategory = !selectedCategory || category === selectedCategory;
                const matchesArea = !selectedArea || area === selectedArea;
                const matchesStatus = !selectedStatus || status === selectedStatus;

                let matchesDate = true;
                if (fromDate) matchesDate = matchesDate && date >= fromDate;
                if (toDate) matchesDate = matchesDate && date <= toDate;

                return matchesSearch && matchesCategory && matchesArea && matchesStatus && matchesDate;
            });

            currentPage = 1;
            renderPage();
        };

        const renderPage = () => {
            const total = filteredRows.length;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;

            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const visibleSet = new Set(filteredRows.slice(startIndex, endIndex));

            allRows.forEach((row) => {
                row.style.display = visibleSet.has(row) ? '' : 'none';
            });

            if (countLabel) countLabel.textContent = `${total} record${total === 1 ? '' : 's'}`;
            if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            if (prevBtn) prevBtn.disabled = currentPage <= 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
            if (noRecordsMessage) noRecordsMessage.style.display = total === 0 ? 'flex' : 'none';
        };

        searchInput?.addEventListener('input', applyFilters);
        filterCategory?.addEventListener('change', applyFilters);
        filterArea?.addEventListener('change', applyFilters);
        filterStatus?.addEventListener('change', applyFilters);
        filterDateFrom?.addEventListener('change', applyFilters);
        filterDateTo?.addEventListener('change', applyFilters);

        pageSizeSelect?.addEventListener('change', () => {
            pageSize = Number(pageSizeSelect.value || 10);
            currentPage = 1;
            renderPage();
        });

        prevBtn?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderPage();
            }
        });

        nextBtn?.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
            if (currentPage < totalPages) {
                currentPage += 1;
                renderPage();
            }
        });

        clearBtn?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterCategory) filterCategory.value = '';
            if (filterArea) filterArea.value = '';
            if (filterStatus) filterStatus.value = '';
            if (filterDateFrom) filterDateFrom.value = '';
            if (filterDateTo) filterDateTo.value = '';
            applyFilters();
        });

        applyFilters();

        recordsRefreshFn = async () => {
            try {
                const res = await fetch('/api/records');
                if (!res.ok) return;
                const payload = await res.json();
                const records = payload.records || [];

                const escapeHtml = (value) => String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');

                const rowsHtml = records.map((record) => {
                    const total = Number(record.total_requests || 0);
                    const resolved = Number(record.resolved_requests || 0);
                    const eff = total > 0 ? (resolved / total) * 100 : 0;
                    const effRounded = Math.round(eff);
                    const effClass = eff > 80 ? 'text-success' : (eff > 50 ? 'text-warning' : 'text-danger');
                    const barClass = eff > 80 ? 'bg-success' : (eff > 50 ? 'bg-warning' : 'bg-danger');
                    const rating = Number(record.satisfaction || 0);
                    const ratingClass = rating >= 4 ? 'high' : (rating >= 3 ? 'med' : 'low');
                    const deptClass = escapeHtml((record.department || 'other').toLowerCase().replace(/\s+/g, '-'));
                    const status = escapeHtml(record.status || 'In Progress');
                    const date = escapeHtml(record.request_date || '—');
                    const city = escapeHtml(record.city || 'Hyderabad, Telangana');
                    const area = escapeHtml(record.area || 'Unspecified');
                    const landmark = escapeHtml(record.landmark || '');
                    const notes = escapeHtml(record.notes || '');
                    const editUrl = `/edit/${record.id}`;
                    const deleteUrl = `/delete/${record.id}`;

                    return `
                    <tr data-category="${escapeHtml(record.department)}" data-status="${status}" data-date="${escapeHtml(record.request_date || '')}" data-area="${area}">
                        <td>
                            <div class="flex-align">
                                <span class="dept-dot ${deptClass}"></span>
                                <span class="font-medium">${escapeHtml(record.department)}</span>
                            </div>
                        </td>
                        <td title="${notes}">${escapeHtml(record.service)}</td>
                        <td>
                            <div class="location-cell">
                                <span class="font-medium">${area}</span>
                                <span class="text-muted text-sm">${city}${landmark ? ` · ${landmark}` : ''}</span>
                            </div>
                        </td>
                        <td><span class="kpi-badge">${status}</span></td>
                        <td>${date}</td>
                        <td>${total}</td>
                        <td>${resolved}</td>
                        <td>
                            <div class="progress-cell">
                                <span class="progress-text ${effClass}">${effRounded}%</span>
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill ${barClass}" style="width:${Math.max(0, Math.min(100, eff))}%"></div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="rating-badge ${ratingClass}">
                                <i data-lucide="star" class="star-icon"></i> ${rating.toFixed(1)}
                            </div>
                        </td>
                        <td>
                            <div class="action-cell">
                                ${isAdmin ? `
                                <a href="${editUrl}" class="action-btn edit-btn" title="Edit"><i data-lucide="edit-3"></i></a>
                                <form action="${deleteUrl}" method="POST" class="inline-form" onsubmit="return confirm('Delete this record?');">
                                    <button type="submit" class="action-btn delete-btn" title="Delete"><i data-lucide="trash-2"></i></button>
                                </form>
                                ` : '<span class="text-muted text-sm">N/A</span>'}
                            </div>
                        </td>
                    </tr>`;
                }).join('');

                tableBody.innerHTML = rowsHtml;
                lucide.createIcons();
                allRows = Array.from(tableBody.querySelectorAll('tr'));
                applyFilters();
            } catch (error) {
                console.error('Failed to refresh records:', error);
            }
        };
    }

    function setupRealtimeSync() {
        let lastVersion = null;

        const triggerRefresh = () => {
            if (typeof dashboardRefreshFn === 'function') dashboardRefreshFn();
            if (typeof recordsRefreshFn === 'function') recordsRefreshFn();
        };

        const checkVersion = async (initial = false) => {
            try {
                const response = await fetch('/api/data-version');
                if (!response.ok) return;
                const payload = await response.json();
                const currentVersion = Number(payload.version || 0);
                if (initial) {
                    lastVersion = currentVersion;
                    return;
                }
                if (lastVersion !== null && currentVersion !== lastVersion) {
                    lastVersion = currentVersion;
                    triggerRefresh();
                } else {
                    lastVersion = currentVersion;
                }
            } catch (error) {
                // Silent fail for background sync checks.
            }
        };

        syncChannel?.addEventListener('message', (event) => {
            if (event.data?.type === 'DATA_CHANGED') {
                triggerRefresh();
                checkVersion();
            }
        });

        window.addEventListener('storage', (event) => {
            if (event.key === 'city_analytics_data_changed') {
                triggerRefresh();
                checkVersion();
            }
        });

        checkVersion(true);
        setInterval(checkVersion, 5000);
    }

    // --- Modal Logic ---
    const addModal = document.getElementById('addModal');
    const addBtn = document.getElementById('addRecordBtn');
    const closeBtn = document.getElementById('closeModal');

    if (addBtn && addModal) {
        addBtn.addEventListener('click', () => {
            addModal.classList.add('active');
        });

        closeBtn.addEventListener('click', () => {
            addModal.classList.remove('active');
        });

        window.addEventListener('click', (e) => {
            if (e.target === addModal) {
                addModal.classList.remove('active');
            }
        });
    }

    // Chart Options & Initialization
    const USE_AREA_MAP_FOR_DISTRIBUTION = true; // flip to false to instantly restore pie chart
    const HYDERABAD_CENTER = [17.385, 78.4867];
    const HYDERABAD_AREA_COORDS = {
        'Ameerpet': [17.4374, 78.4482],
        'Banjara Hills': [17.4126, 78.4388],
        'Begumpet': [17.4446, 78.4661],
        'Charminar': [17.3616, 78.4747],
        'Dilsukhnagar': [17.3688, 78.5247],
        'Gachibowli': [17.4401, 78.3489],
        'Hitec City': [17.4474, 78.3762],
        'Jubilee Hills': [17.4310, 78.4072],
        'Kondapur': [17.4661, 78.3654],
        'Kukatpally': [17.4948, 78.3996],
        'LB Nagar': [17.3457, 78.5522],
        'Madhapur': [17.4483, 78.3915],
        'Malakpet': [17.3731, 78.4900],
        'Mehdipatnam': [17.3950, 78.4331],
        'Miyapur': [17.4966, 78.3566],
        'Nampally': [17.3924, 78.4676],
        'Secunderabad': [17.4399, 78.4983],
        'Somajiguda': [17.4239, 78.4634],
        'Tarnaka': [17.4283, 78.5386],
        'Uppal': [17.4000, 78.5591],
    };

    let servicePerformanceChart, monthlyTrendChart, categoryPieChart, departmentEfficiencyChart;
    let areaMapInstance, areaMapLayer;
    let useAreaMap = false;
    const previousKpiValues = {};
    const hasChartJs = typeof Chart !== 'undefined';

    if (hasChartJs) {
        Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
        Chart.defaults.color = palette.secondary;
    }

    const commonOpts = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 850,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: palette.textMain,
                titleFont: { size: 13, weight: 600 },
                bodyFont: { size: 12 },
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                boxPadding: 4
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        }
    };

    function initCharts() {
        // Service Performance (Bar Chart)
        if (!hasChartJs) return;

        const ctxPerf = document.getElementById('servicePerformanceChart')?.getContext('2d');
        if (ctxPerf) {
            servicePerformanceChart = new Chart(ctxPerf, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Total',
                            data: [],
                            backgroundColor: palette.primaryLight,
                            borderRadius: 6,
                            barPercentage: 0.6,
                        },
                        {
                            label: 'Resolved',
                            data: [],
                            backgroundColor: palette.primary,
                            borderRadius: 6,
                            barPercentage: 0.6,
                        }
                    ]
                },
                options: {
                    ...commonOpts,
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 11 } }
                        },
                        y: {
                            grid: { color: palette.border },
                            border: { display: false }
                        }
                    }
                }
            });
        }

        // Monthly Trends (Line)
        const ctxMonthly = document.getElementById('monthlyTrendChart')?.getContext('2d');
        if (ctxMonthly) {
            monthlyTrendChart = new Chart(ctxMonthly, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Requests',
                            data: [],
                            borderColor: palette.primary,
                            backgroundColor: 'rgba(29, 78, 216, 0.12)',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                        },
                        {
                            label: 'Completed',
                            data: [],
                            borderColor: palette.success,
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                        }
                    ],
                },
                options: {
                    ...commonOpts,
                    scales: {
                        x: {
                            grid: { display: false },
                        },
                        y: {
                            grid: { color: palette.border },
                            border: { display: false },
                            beginAtZero: true,
                        },
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                padding: 14,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8
                            }
                        }
                    }
                }
            });
        }

        // Area Distribution (Map or Pie fallback)
        const areaMapEl = document.getElementById('areaMap');
        const areaLegendEl = document.getElementById('areaMapLegend');
        const pieCanvas = document.getElementById('categoryPieChart');
        useAreaMap = Boolean(USE_AREA_MAP_FOR_DISTRIBUTION && areaMapEl && typeof L !== 'undefined');

        if (useAreaMap) {
            if (pieCanvas) pieCanvas.style.display = 'none';
            if (areaMapEl) areaMapEl.style.display = 'block';
            if (areaLegendEl) areaLegendEl.style.display = 'grid';

            if (!areaMapInstance) {
                areaMapInstance = L.map(areaMapEl, {
                    zoomControl: false,
                    dragging: true,
                    scrollWheelZoom: false,
                    doubleClickZoom: false,
                }).setView(HYDERABAD_CENTER, 11);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                    maxZoom: 18,
                }).addTo(areaMapInstance);

                areaMapLayer = L.layerGroup().addTo(areaMapInstance);
                setTimeout(() => areaMapInstance.invalidateSize(), 120);
                window.addEventListener('resize', () => areaMapInstance.invalidateSize());
            }
        } else {
            if (areaMapEl) areaMapEl.style.display = 'none';
            if (areaLegendEl) areaLegendEl.style.display = 'none';
            const ctxPie = pieCanvas?.getContext('2d');
            if (ctxPie) {
                categoryPieChart = new Chart(ctxPie, {
                    type: 'pie',
                    data: {
                        labels: [],
                        datasets: [{
                            data: [],
                            backgroundColor: [
                                palette.primary,
                                palette.success,
                                palette.warning,
                                palette.info,
                                palette.secondary,
                                palette.danger,
                            ],
                            borderColor: '#ffffff',
                            borderWidth: 2,
                        }],
                    },
                    options: {
                        ...commonOpts,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'bottom',
                                labels: {
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                },
                            },
                        },
                    },
                });
            }
        }

        // Department Efficiency (Horizontal Bar)
        const ctxDeptEfficiency = document.getElementById('departmentEfficiencyChart')?.getContext('2d');
        if (ctxDeptEfficiency) {
            departmentEfficiencyChart = new Chart(ctxDeptEfficiency, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Efficiency %',
                        data: [],
                        backgroundColor: 'rgba(15, 118, 110, 0.72)',
                        borderColor: palette.secondary,
                        borderWidth: 0,
                        borderRadius: 8,
                        barThickness: 16,
                    }],
                },
                options: {
                    ...commonOpts,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            backgroundColor: palette.textMain,
                            callbacks: {
                                label: (ctx) => `${ctx.parsed.x.toFixed(1)}%`,
                            },
                        },
                    },
                    scales: {
                        x: {
                            min: 0,
                            max: 100,
                            grid: { color: palette.border },
                            ticks: {
                                callback: (value) => `${value}%`,
                            },
                        },
                        y: {
                            grid: { display: false },
                        },
                    },
                },
            });
        }
    }

    async function fetchData() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            updateDashboard(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    function updateDashboard(data) {
        const getAreaHeatColor = (value, maxValue) => {
            const ratio = maxValue > 0 ? value / maxValue : 0;
            if (ratio >= 0.75) return '#dc2626';
            if (ratio >= 0.5) return '#f59e0b';
            if (ratio >= 0.25) return '#0284c7';
            return '#0f766e';
        };

        const renderAreaMap = (areaDistribution) => {
            if (!useAreaMap || !areaMapInstance || !areaMapLayer) return;
            const entries = Object.entries(areaDistribution || {}).filter(([, count]) => Number(count) > 0);
            areaMapLayer.clearLayers();

            if (entries.length === 0) {
                areaMapInstance.setView(HYDERABAD_CENTER, 11);
                return;
            }

            const maxCount = Math.max(...entries.map(([, count]) => Number(count)));
            const bounds = [];

            entries.forEach(([area, count]) => {
                const numericCount = Number(count);
                const coords = HYDERABAD_AREA_COORDS[area] || HYDERABAD_CENTER;
                const color = getAreaHeatColor(numericCount, maxCount);
                const radius = Math.max(7, Math.min(22, 7 + numericCount * 1.3));

                const marker = L.circleMarker(coords, {
                    radius,
                    color,
                    fillColor: color,
                    fillOpacity: 0.3,
                    weight: 2,
                });
                marker.bindTooltip(`<strong>${area}</strong><br/>Records: ${numericCount}`, {
                    direction: 'top',
                    opacity: 0.92,
                });
                marker.addTo(areaMapLayer);
                bounds.push(coords);
            });

            if (bounds.length > 1) {
                areaMapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
            } else {
                areaMapInstance.setView(bounds[0], 12);
            }
            setTimeout(() => areaMapInstance.invalidateSize(), 60);

            const areaLegend = document.getElementById('areaMapLegend');
            if (areaLegend) {
                const topAreas = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 5);
                areaLegend.innerHTML = topAreas.map(([area, count]) => (
                    `<div class="area-map-legend-item"><span>${area}</span><strong>${Number(count)}</strong></div>`
                )).join('');
            }
        };

        const setKpiTrend = (elementId, key, currentValue, lowerIsBetter = false) => {
            const trendEl = document.getElementById(elementId);
            if (!trendEl) return;

            const previousValue = previousKpiValues[key];
            previousKpiValues[key] = currentValue;

            if (previousValue === undefined || previousValue === 0) {
                trendEl.className = 'kpi-trend';
                trendEl.textContent = 'Baseline';
                return;
            }

            const deltaPercent = ((currentValue - previousValue) / previousValue) * 100;
            const improved = lowerIsBetter ? deltaPercent < 0 : deltaPercent >= 0;
            const arrow = improved ? '↑' : '↓';
            trendEl.className = `kpi-trend ${improved ? 'up' : 'down'}`;
            trendEl.textContent = `${arrow} ${Math.abs(deltaPercent).toFixed(1)}% vs last refresh`;
        };

        // --- KPI Cards Update ---
        const total = data.kpi.total_requests || 0;
        const resolved = data.kpi.total_resolved || 0;
        const pending = total - resolved;
        const performance = data.kpi.overall_efficiency || 0;

        const elTotal = document.getElementById('kpiTotalRequests');
        const elCompleted = document.getElementById('kpiCompleted');
        const elPending = document.getElementById('kpiPending');
        const elPerf = document.getElementById('kpiPerformance');

        animateCount(elTotal, total);
        animateCount(elCompleted, resolved);
        animateCount(elPending, pending);
        animateCount(elPerf, performance, '%');

        setKpiTrend('kpiTrendTotal', 'total', total);
        setKpiTrend('kpiTrendCompleted', 'completed', resolved);
        setKpiTrend('kpiTrendPending', 'pending', pending, true);
        setKpiTrend('kpiTrendPerformance', 'performance', performance);

        // Timer update
        const timeEl = document.getElementById('lastUpdated');
        if (timeEl) {
            const now = new Date();
            timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Alert handling
        const alertBox = document.getElementById('criticalAlerts');
        const alertText = document.getElementById('alertText');
        if (data.kpi.critical_alerts && data.kpi.critical_alerts.length > 0 && alertBox) {
            alertBox.style.display = 'flex';
            alertText.innerText = data.kpi.critical_alerts.slice(0, 2).join(' • ');
        } else if (alertBox) {
            alertBox.style.display = 'none';
        }

        // --- Charts Update ---
        const services = data.charts.services || [];

        // 1. Service Performance Bar Chart
        if (servicePerformanceChart) {
            const top5 = [...services].sort((a, b) => b.requests - a.requests).slice(0, 5);
            servicePerformanceChart.data.labels = top5.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name);
            servicePerformanceChart.data.datasets[0].data = top5.map(s => s.requests);
            servicePerformanceChart.data.datasets[1].data = top5.map(s => s.resolved);
            servicePerformanceChart.update();
        }

        // 2. Monthly Trends Line Chart
        if (monthlyTrendChart && data.charts.monthly_trends) {
            monthlyTrendChart.data.labels = data.charts.monthly_trends.labels || [];
            monthlyTrendChart.data.datasets[0].data = data.charts.monthly_trends.requests || [];
            monthlyTrendChart.data.datasets[1].data = data.charts.monthly_trends.completed || [];
            monthlyTrendChart.update();
        }

        // 3. Area Distribution Pie Chart
        const areaDistribution = data.charts.area_distribution || data.charts.category_distribution;
        if (useAreaMap && areaDistribution) {
            renderAreaMap(areaDistribution);
        } else if (categoryPieChart && areaDistribution) {
            categoryPieChart.data.labels = Object.keys(areaDistribution);
            categoryPieChart.data.datasets[0].data = Object.values(areaDistribution);
            categoryPieChart.update();
        }

        // 4. Department Efficiency Horizontal Bar
        const deptEfficiency = data.charts.dept_efficiency || {};
        const deptEntries = Object.entries(deptEfficiency).sort((a, b) => b[1] - a[1]);
        if (departmentEfficiencyChart && deptEntries.length > 0) {
            departmentEfficiencyChart.data.labels = deptEntries.map(([name]) => name);
            departmentEfficiencyChart.data.datasets[0].data = deptEntries.map(([, value]) => Number(value));
            departmentEfficiencyChart.update();
        }

        // 5. Operational Highlights
        const highlightsEl = document.getElementById('dashboardHighlights');
        if (highlightsEl) {
            const topDept = deptEntries[0];
            const lowDept = deptEntries[deptEntries.length - 1];
            const areaEntries = Object.entries(areaDistribution || {}).sort((a, b) => b[1] - a[1]);
            const topArea = areaEntries[0];
            const alertCount = (data.kpi.critical_alerts || []).length;

            const highlights = [];
            if (topDept) highlights.push(`Top efficiency: ${topDept[0]} at ${Number(topDept[1]).toFixed(1)}%.`);
            if (lowDept) highlights.push(`Needs attention: ${lowDept[0]} at ${Number(lowDept[1]).toFixed(1)}%.`);
            if (topArea) highlights.push(`Highest request load: ${topArea[0]} (${topArea[1]} records).`);
            highlights.push(`Active critical alerts: ${alertCount}.`);

            highlightsEl.innerHTML = highlights.map((item) => `<li class="insight-item">${item}</li>`).join('');
        }
    }

    // Initialize
    setupLoginForm();
    setupAddRecordForm();
    setupHomeMicroInteractions();
    setupSidebarNavigation();
    setupPageTransitions();
    setupRevealAnimations();
    initRecordsTable();
    updateServices();

    if (hasChartJs && document.getElementById('servicePerformanceChart')) {
        initCharts();
        fetchData();
        setInterval(fetchData, 30000);
        dashboardRefreshFn = fetchData;

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => {
            // Optional: add spinning animation class here
            refreshBtn.querySelector('i').classList.add('lucide-spin');
            fetchData().finally(() => {
                setTimeout(() => refreshBtn.querySelector('i').classList.remove('lucide-spin'), 500);
            });
        });
    }

    setupRealtimeSync();
});
