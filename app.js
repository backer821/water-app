 let currentUser = null;
let lastBillRef = { BillNo: null, CCode: null };

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function setMsg(id, text, isError=false) {
  const el = $(id);
  el.textContent = text || '';
  el.style.color = isError ? '#b00020' : '#666';
}

function onLoginSuccess(user) {
  currentUser = user;
  hide('loginView');
  show('userBar');
  $('userInfo').textContent = `${user.username} (${user.role})`;

  if (user.role === 'Admin') {
    show('adminView');
    loadBills();
  } else if (user.role === 'MeterReader') {
    show('readerView');
  } else if (user.role === 'Consumer') {
    show('consumerView');
    loadMyBills();
    loadMyProfile();
  }
}

function logout() {
  api.clearToken();
  currentUser = null;
  location.reload();
}

async function loadBills() {
  try {
    const res = await api.call('billing.list', {});
    const listDiv = $('billList');
    const bills = res.bills || [];
    if (bills.length === 0) {
      listDiv.innerHTML = '<em>No bills</em>';
      return;
    }
    const html = ['<table><thead><tr><th>BillNo</th><th>BillDate</th><th>Start</th><th>End</th><th>Days</th><th>Status</th></tr></thead><tbody>'];
    bills.forEach(b => {
      html.push(`<tr><td>${b.BillNo}</td><td>${b.BillDate}</td><td>${b.ConsumptionStartDate}</td><td>${b.ConsumptionEndDate}</td><td>${b.TotalDays}</td><td>${b.Status}</td></tr>`);
    });
    html.push('</tbody></table>');
    listDiv.innerHTML = html.join('');
  } catch (err) {
    setMsg('billingMsg', err.message, true);
  }
}

async function loadOpenBillsSelector() {
  try {
    const res = await api.call('billing.list', { status: 'OPEN' });
    const bills = res.bills || [];
    const sel = $('selectBill');
    sel.innerHTML = '';
    bills.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.BillNo;
      opt.textContent = `${b.BillNo} (${b.ConsumptionStartDate} to ${b.ConsumptionEndDate})`;
      sel.appendChild(opt);
    });
    $('readerBillInfo').textContent = bills.length ? `Selected: ${sel.value}` : 'No OPEN bills';
    $('readBillNo').value = bills.length ? sel.value : '';
    sel.onchange = () => {
      $('readerBillInfo').textContent = `Selected: ${sel.value}`;
      $('readBillNo').value = sel.value;
    };
  } catch (err) {
    setMsg('readingMsg', err.message, true);
  }
}

async function loadMyBills() {
  try {
    const res = await api.call('bill.listMine', {});
    const bills = res.bills || [];
    const div = $('myBills');
    if (bills.length === 0) { div.innerHTML = '<em>No bills yet</em>'; return; }
    let html = '<table><thead><tr><th>BillNo</th><th>BillDate</th><th>Consumption</th><th>Excess</th><th>Fine</th><th>Net</th><th>Action</th></tr></thead><tbody>';
    bills.forEach(b => {
      html += `<tr>
        <td>${b.BillNo}</td><td>${b.BillDate}</td>
        <td>${b.Consumption}</td><td>${b.ExcessUsage}</td><td>${b.Fine}</td><td>${b.NetAmount}</td>
        <td><button onclick="viewBill('${b.BillNo}','${b.CCode}')">View</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    div.innerHTML = html;
  } catch (err) {
    setMsg('profileMsg', err.message, true);
  }
}

async function viewBill(billNo, ccode) {
  try {
    const res = await api.call('bill.get', { BillNo: billNo, CCode: ccode });
    openPrintWindow(res.bill, res.reading);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function openPrintWindow(bill, reading) {
  const w = window.open('', '_blank');
  const img = reading && reading.MeterImageLink ? `<img src="${reading.MeterImageLink}" style="max-width:300px;"/>` : '';
  const html = `
  <html><head><title>Bill ${bill.BillNo}</title>
  <style>
  body { font-family: Arial, sans-serif; padding: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  td, th { border: 1px solid #ccc; padding: 6px; }
  </style></head><body>
  <h2>Monthly Bill</h2>
  <p>Bill No: ${bill.BillNo}<br/>Bill Date: ${bill.BillDate}</p>
  <table>
    <tr><th>CCode</th><td>${bill.CCode}</td></tr>
    <tr><th>Meter No</th><td>${bill.MeterNo}</td></tr>
    <tr><th>Consumption</th><td>${bill.Consumption}</td></tr>
    <tr><th>Excess Usage</th><td>${bill.ExcessUsage}</td></tr>
    <tr><th>Fine</th><td>${bill.Fine}</td></tr>
    <tr><th>Arrear</th><td>${bill.Arrear}</td></tr>
    <tr><th>Other Fees</th><td>${bill.OtherFees}</td></tr>
    <tr><th>Net Amount</th><td><strong>${bill.NetAmount}</strong></td></tr>
  </table>
  <h3>Meter Image</h3>
  ${img}
  <script>window.print();</script>
  </body></html>
  `;
  w.document.write(html);
  w.document.close();
}

/* Event handlers */
window.addEventListener('DOMContentLoaded', async () => {
  // Login
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('loginMsg', '');
    try {
      const res = await api.login($('loginUsername').value, $('loginPassword').value);
      onLoginSuccess(res.user);
    } catch (err) {
      setMsg('loginMsg', err.message, true);
    }
  });

  $('btnLogout').addEventListener('click', logout);

  // Admin
  $('formCreateBilling').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('billingMsg', '');
    try {
      const res = await api.call('billing.create', {
        BillDate: $('billDate').value,
        ConsumptionStartDate: $('startDate').value,
        ConsumptionEndDate: $('endDate').value
      });
      setMsg('billingMsg', `Created Bill ${res.BillNo} (Days: ${res.TotalDays})`);
      loadBills();
    } catch (err) {
      setMsg('billingMsg', err.message, true);
    }
  });
  $('btnLoadBills').addEventListener('click', loadBills);

  $('formAddMeter').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('meterList', '');
    try {
      await api.call('meters.create', {
        MeterNo: $('meterNo').value, Model: $('meterModel').value, PurchaseDate: $('meterPurchase').value
      });
      setMsg('meterList', 'Meter added');
    } catch (err) {
      setMsg('meterList', err.message, true);
    }
  });
  $('btnListMeters').addEventListener('click', async () => {
    try {
      const res = await api.call('meters.list', {});
      const list = res.meters || [];
      let html = '<table><thead><tr><th>MeterNo</th><th>Model</th><th>PurchaseDate</th></tr></thead><tbody>';
      list.forEach(m => { html += `<tr><td>${m.MeterNo}</td><td>${m.Model}</td><td>${m.PurchaseDate}</td></tr>`; });
      html += '</tbody></table>';
      $('meterList').innerHTML = html;
    } catch (err) {
      setMsg('meterList', err.message, true);
    }
  });

  $('btnLoadUnassigned').addEventListener('click', async () => {
    try {
      const res = await api.call('mapping.listUnassigned', {});
      const meters = res.unassignedMeters || [];
      if (meters.length === 0) { $('unassignedMeters').innerHTML = '<em>None</em>'; return; }
      let html = '<ul>';
      meters.forEach(m => { html += `<li>${m.MeterNo} (${m.Model || ''})</li>`; });
      html += '</ul>';
      $('unassignedMeters').innerHTML = html;
    } catch (err) {
      setMsg('mappingMsg', err.message, true);
    }
  });

  $('formAssignMapping').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('mappingMsg', '');
    try {
      await api.call('mapping.assign', { MeterNo: $('mapMeterNo').value, CCode: $('mapCCode').value, StartDate: $('mapStart').value });
      setMsg('mappingMsg', 'Mapping assigned');
    } catch (err) {
      setMsg('mappingMsg', err.message, true);
    }
  });

  $('formEndMapping').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('mappingMsg', '');
    try {
      await api.call('mapping.end', { MeterNo: $('endMeterNo').value, CCode: $('endCCode').value, EndDate: $('endDateMap').value });
      setMsg('mappingMsg', 'End date set');
    } catch (err) {
      setMsg('mappingMsg', err.message, true);
    }
  });

  // Reader
  $('btnLoadOpenBills').addEventListener('click', loadOpenBillsSelector);

  $('btnLoadPrevReadings').addEventListener('click', async () => {
    $('prevReadings').innerHTML = '';
    try {
      const ccode = $('readCCode').value.trim();
      if (!ccode) { setMsg('readingMsg', 'Enter CCode first', true); return; }
      const res = await api.call('readings.previous', { CCode: ccode });
      const list = res.readings || [];
      let html = '<table><thead><tr><th>Date</th><th>BillNo</th><th>Pre</th><th>Current</th><th>Consumption</th></tr></thead><tbody>';
      list.slice(-5).forEach(r => {
        html += `<tr><td>${r.Date}</td><td>${r.BillNo}</td><td>${r.MeterPreValue}</td><td>${r.MeterCurrentValue}</td><td>${r.Consumption}</td></tr>`;
      });
      html += '</tbody></table>';
      $('prevReadings').innerHTML = html;
      $('readCCode2').value = ccode;
    } catch (err) {
      setMsg('readingMsg', err.message, true);
    }
  });

  $('formReading').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('readingMsg', '');
    try {
      const billNo = $('readBillNo').value.trim();
      const ccode = $('readCCode2').value.trim();
      const current = Number($('readCurrent').value);

      let imageBase64 = null;
      const file = $('readImage').files[0];
      if (file) {
        imageBase64 = await fileToBase64(file);
      }

      const res = await api.call('readings.add', {
        BillNo: billNo, CCode: ccode, MeterCurrentValue: current, imageBase64
      });

      lastBillRef = { BillNo: res.bill.BillNo, CCode: res.bill.CCode };
      setMsg('readingMsg', `Reading saved. Net: ${res.bill.NetAmount}`);
    } catch (err) {
      setMsg('readingMsg', err.message, true);
    }
  });

  $('btnPrintLast').addEventListener('click', async () => {
    if (!lastBillRef.BillNo) { setMsg('printMsg', 'No bill to print yet', true); return; }
    try {
      const res = await api.call('bill.get', lastBillRef);
      openPrintWindow(res.bill, res.reading);
      setMsg('printMsg', '');
    } catch (err) {
      setMsg('printMsg', err.message, true);
    }
  });

  $('formReaderPwd').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('readerPwdMsg', '');
    try {
      await api.call('users.updatePassword', { oldPassword: $('readerOldPwd').value, newPassword: $('readerNewPwd').value });
      setMsg('readerPwdMsg', 'Password updated');
      $('readerOldPwd').value = ''; $('readerNewPwd').value = '';
    } catch (err) {
      setMsg('readerPwdMsg', err.message, true);
    }
  });

  // Consumer
  $('btnLoadMyBills').addEventListener('click', loadMyBills);

  $('formProfile').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('profileMsg', '');
    try {
      await api.call('profile.update', {
        FamilyName: $('pfFamilyName').value,
        HouseNo: $('pfHouseNo').value,
        KSEBNo: $('pfKSEBNo').value,
        PhoneNo: $('pfPhoneNo').value,
        Email: $('pfEmail').value
      });
      setMsg('profileMsg', 'Profile updated');
    } catch (err) {
      setMsg('profileMsg', err.message, true);
    }
  });

  $('formConsumerPwd').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('consPwdMsg', '');
    try {
      await api.call('users.updatePassword', { oldPassword: $('consOldPwd').value, newPassword: $('consNewPwd').value });
      setMsg('consPwdMsg', 'Password updated');
      $('consOldPwd').value = ''; $('consNewPwd').value = '';
    } catch (err) {
      setMsg('consPwdMsg', err.message, true);
    }
  });

  // Try auto-login if token exists
  const token = api.getToken();
  if (token) {
    try {
      // Call a harmless endpoint to validate
      await api.call('health.ping', {});
      // We need user info for role; ask user to re-login OR keep a cache after login.
      // For demo simplicity, require login again to show role-specific view:
      // Optionally: add 'auth.whoami' endpoint to return user claims.
    } catch (err) {
      api.clearToken();
    }
  }
});

async function loadMyProfile() {
  try {
    const res = await api.call('profile.get', {});
    const p = res.profile || {};
    $('pfFamilyName').value = p.FamilyName || '';
    $('pfHouseNo').value = p.HouseNo || '';
    $('pfKSEBNo').value = p.KSEBNo || '';
    $('pfPhoneNo').value = p.PhoneNo || '';
    $('pfEmail').value = p.Email || '';
  } catch (err) {
    setMsg('profileMsg', err.message, true);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
