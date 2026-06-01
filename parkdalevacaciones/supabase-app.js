(function () {
  const LOCAL_USER = { id: 'local', email: 'local@parkdale.local' };

  let supabaseClient = null;
  let supabaseReady = false;
  let supabaseEnabled = false;
  let currentUser = null;
  let runtimeConfig = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    authEmailDomain: 'parkdale.local',
    missing: []
  };
  const localFallbackAllowed = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

  function toast(message, type = 'success') {
    if (typeof showToast === 'function') showToast(message, type);
    else window.alert(message);
  }

  async function loadRuntimeConfig() {
    const localConfig = window.PARKDALE_SUPABASE_CONFIG || {};
    runtimeConfig = { ...runtimeConfig, ...localConfig };

    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) {
        const vercelConfig = await response.json();
        runtimeConfig = {
          ...runtimeConfig,
          ...vercelConfig,
          supabaseUrl: vercelConfig.supabaseUrl || runtimeConfig.supabaseUrl,
          supabaseAnonKey: vercelConfig.supabaseAnonKey || runtimeConfig.supabaseAnonKey,
          authEmailDomain: vercelConfig.authEmailDomain || runtimeConfig.authEmailDomain
        };
      }
    } catch (_) {
      // Local XAMPP usage will not have the Vercel API route.
    }

    runtimeConfig.supabaseUrl = (runtimeConfig.supabaseUrl || '').trim();
    runtimeConfig.supabaseAnonKey = (runtimeConfig.supabaseAnonKey || '').trim();
    runtimeConfig.authEmailDomain = (runtimeConfig.authEmailDomain || 'parkdale.local').trim();
  }

  async function ensureSupabase() {
    if (supabaseReady) return supabaseEnabled;
    supabaseReady = true;
    await loadRuntimeConfig();

    if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey || !window.supabase) {
      supabaseEnabled = false;
      currentUser = localFallbackAllowed ? LOCAL_USER : null;
      runtimeConfig.missing = [
        !runtimeConfig.supabaseUrl ? 'SUPABASE_URL' : null,
        !runtimeConfig.supabaseAnonKey ? 'SUPABASE_ANON_KEY' : null,
        !window.supabase ? 'cliente Supabase' : null
      ].filter(Boolean);
      console.warn('Supabase no esta configurado:', runtimeConfig.missing.join(', '));
      return false;
    }

    supabaseClient = window.supabase.createClient(
      runtimeConfig.supabaseUrl,
      runtimeConfig.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    supabaseEnabled = true;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) console.warn(error.message);
    currentUser = data && data.session ? data.session.user : null;

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      if (currentUser) {
        setTimeout(async () => {
          await loadData();
          showApp();
          initApp();
        }, 0);
      } else {
        showLogin();
      }
    });

    return true;
  }

  function loginIdentifierToEmail(value) {
    const user = value.trim();
    if (user.includes('@')) return user;
    return `${user}@${runtimeConfig.authEmailDomain}`;
  }

  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
  }

  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
  }

  function localLoadData() {
    empleados = JSON.parse(localStorage.getItem('pm_empleados') || '[]');
    registros = JSON.parse(localStorage.getItem('pm_registros') || '[]');
    folioCounter = parseInt(localStorage.getItem('pm_folio') || '1', 10);
  }

  function localSaveData() {
    localStorage.setItem('pm_empleados', JSON.stringify(empleados));
    localStorage.setItem('pm_registros', JSON.stringify(registros));
    localStorage.setItem('pm_folio', String(folioCounter));
  }

  function dbEmployeeToUi(row) {
    return {
      id: row.id,
      num: row.num,
      nombre: row.nombre,
      departamento: row.departamento,
      turno: row.turno,
      fecha_ingreso: row.fecha_ingreso
    };
  }

  function dbRecordToUi(row) {
    return {
      id: row.id,
      folio: row.folio,
      num_emp: row.num_emp,
      empleado: row.empleado,
      departamento: row.departamento,
      turno: row.turno,
      fecha_ingreso: row.fecha_ingreso,
      antiguedad: row.antiguedad,
      dias_aplican: row.dias_aplican,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      dias_disponibles: row.dias_disponibles,
      dias_tomados: row.dias_tomados,
      fecha_regreso: row.fecha_regreso,
      dias_pendientes: row.dias_pendientes
    };
  }

  async function loadData() {
    if (!supabaseEnabled || !currentUser) {
      localLoadData();
      return;
    }

    const [empleadosResult, registrosResult] = await Promise.all([
      supabaseClient.from('empleados').select('*').order('nombre', { ascending: true }),
      supabaseClient.from('registros').select('*').order('created_at', { ascending: false })
    ]);

    if (empleadosResult.error) throw empleadosResult.error;
    if (registrosResult.error) throw registrosResult.error;

    empleados = (empleadosResult.data || []).map(dbEmployeeToUi);
    registros = (registrosResult.data || []).map(dbRecordToUi);

    const maxFolio = registros.reduce((max, r) => {
      const n = parseInt(r.folio, 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    folioCounter = maxFolio + 1;
  }

  function employeePayloadFromForm(prefix) {
    return {
      num: document.getElementById(prefix + '_num').value.trim(),
      nombre: document.getElementById(prefix + '_nombre').value.trim(),
      departamento: document.getElementById(prefix + '_depto').value,
      turno: document.getElementById(prefix + '_turno').value,
      fecha_ingreso: document.getElementById(prefix + '_ingreso').value
    };
  }

  async function insertEmployee(payload) {
    if (!supabaseEnabled) {
      return payload;
    }

    const { data, error } = await supabaseClient
      .from('empleados')
      .insert({ ...payload, user_id: currentUser.id })
      .select()
      .single();
    if (error) throw error;
    return dbEmployeeToUi(data);
  }

  async function updateEmployee(id, payload) {
    if (!supabaseEnabled) {
      return payload;
    }

    const { data, error } = await supabaseClient
      .from('empleados')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return dbEmployeeToUi(data);
  }

  async function deleteEmployee(id) {
    if (!supabaseEnabled) {
      localSaveData();
      return;
    }

    const { error } = await supabaseClient.from('empleados').delete().eq('id', id);
    if (error) throw error;
  }

  async function insertRecord(payload) {
    if (!supabaseEnabled) {
      folioCounter++;
      localSaveData();
      return payload;
    }

    const { data, error } = await supabaseClient
      .from('registros')
      .insert({ ...payload, folio: undefined, user_id: currentUser.id })
      .select()
      .single();
    if (error) throw error;
    return dbRecordToUi(data);
  }

  window.saveData = localSaveData;

  window.doLogin = async function doLoginSupabase() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();

    if (!u || !p) {
      toast('Ingresa usuario y contraseña.', 'error');
      return;
    }

    const hasSupabase = await ensureSupabase();
    if (!hasSupabase) {
      if (!localFallbackAllowed) {
        toast('Supabase no esta configurado. Falta: ' + runtimeConfig.missing.join(', ') + '. Revisa las variables de entorno en Vercel.', 'error');
      } else if (u === 'isaifonseca' && p === 'fonseca01') {
        localLoadData();
        showApp();
        initApp();
      } else {
        toast('Credenciales incorrectas o Supabase no configurado.', 'error');
      }
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: loginIdentifierToEmail(u),
      password: p
    });

    if (error) {
      toast('Credenciales incorrectas. Intenta de nuevo.', 'error');
      return;
    }

    currentUser = data.user;
    await loadData();
    showApp();
    initApp();
  };
  try { doLogin = window.doLogin; } catch (_) {}

  window.doLogout = async function doLogoutSupabase() {
    if (await ensureSupabase()) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        toast('No se pudo cerrar sesión: ' + error.message, 'error');
        return;
      }
    }
    empleados = [];
    registros = [];
    folioCounter = 1;
    showLogin();
  };
  try { doLogout = window.doLogout; } catch (_) {}

  window.addEmpleado = async function addEmpleadoSupabase() {
    try {
      await ensureSupabase();
      const payload = employeePayloadFromForm('ae');
      if (!payload.num || !payload.nombre || !payload.departamento || !payload.turno || !payload.fecha_ingreso) {
        toast('Por favor completa todos los campos.', 'error');
        return;
      }
      if (empleados.some((e) => String(e.num) === String(payload.num))) {
        toast('El número de empleado ya existe.', 'error');
        return;
      }
      const saved = await insertEmployee(payload);
      empleados.push(saved);
      if (!supabaseEnabled) localSaveData();
      clearAddEmp();
      renderStats();
      toast('Empleado registrado correctamente.', 'success');
    } catch (error) {
      toast('No se pudo registrar el empleado: ' + error.message, 'error');
    }
  };
  try { addEmpleado = window.addEmpleado; } catch (_) {}

  window.actualizarEmpleado = async function actualizarEmpleadoSupabase() {
    try {
      await ensureSupabase();
      const i = parseInt(document.getElementById('edit_idx').value, 10);
      const original = empleados[i];
      const payload = employeePayloadFromForm('edit');

      if (!payload.num || !payload.nombre || !payload.departamento || !payload.turno || !payload.fecha_ingreso) {
        toast('Por favor completa todos los campos.', 'error');
        return;
      }
      if (empleados.some((e, ei) => String(e.num) === String(payload.num) && ei !== i)) {
        toast('El número de empleado ya existe.', 'error');
        return;
      }

      const saved = await updateEmployee(original && original.id, payload);
      empleados[i] = { ...saved, id: original && original.id ? saved.id : original && original.id };
      if (!supabaseEnabled) {
        empleados[i] = { ...payload, id: original && original.id };
        localSaveData();
      }
      closeModal('modalEditEmp');
      renderEmpleados();
      renderStats();
      toast('Empleado actualizado correctamente.', 'success');
    } catch (error) {
      toast('No se pudo actualizar el empleado: ' + error.message, 'error');
    }
  };
  try { actualizarEmpleado = window.actualizarEmpleado; } catch (_) {}

  window.eliminarEmpleado = async function eliminarEmpleadoSupabase() {
    try {
      await ensureSupabase();
      const i = parseInt(document.getElementById('edit_idx').value, 10);
      const employee = empleados[i];
      if (!employee) return;
      if (!confirm('¿Estás seguro de eliminar este empleado?')) return;

      empleados.splice(i, 1);
      await deleteEmployee(employee.id);
      closeModal('modalEditEmp');
      renderEmpleados();
      renderStats();
      toast('Empleado eliminado correctamente.', 'success');
    } catch (error) {
      toast('No se pudo eliminar el empleado: ' + error.message, 'error');
    }
  };
  try { eliminarEmpleado = window.eliminarEmpleado; } catch (_) {}

  window.guardarFormato = async function guardarFormatoSupabase() {
    try {
      await ensureSupabase();
      const numEmp = document.getElementById('gf_empleado').value;
      const fi = document.getElementById('gf_fecha_inicio').value;
      const ff = document.getElementById('gf_fecha_fin').value;

      if (!numEmp) { toast('Selecciona un empleado.', 'error'); return; }
      if (!fi || !ff) { toast('Completa las fechas de vacaciones.', 'error'); return; }

      const disp = parseInt(document.getElementById('gf_dias_disp').value, 10) || 0;
      if (disp <= 0) {
        toast('Este empleado no cuenta con días disponibles de vacaciones.', 'error');
        return;
      }

      const tomados = countWeekdays(fi, ff);
      if (tomados > disp) {
        toast(`El número de días solicitados (${tomados}) supera los días disponibles (${disp}).`, 'error');
        return;
      }

      const employee = empleados.find((e) => String(e.num) === String(numEmp));
      if (!employee) {
        toast('No se encontró el empleado seleccionado.', 'error');
        return;
      }

      const folio = String(folioCounter).padStart(7, '0');
      const record = {
        folio,
        num_emp: employee.num,
        empleado: employee.nombre,
        departamento: employee.departamento,
        turno: employee.turno,
        fecha_ingreso: employee.fecha_ingreso,
        antiguedad: document.getElementById('gf_antiguedad').value,
        dias_aplican: document.getElementById('gf_dias_aplican').value,
        fecha_inicio: fi,
        fecha_fin: ff,
        dias_disponibles: disp,
        dias_tomados: tomados,
        fecha_regreso: nextWeekday(ff),
        dias_pendientes: disp - tomados
      };

      const saved = await insertRecord(record);
      registros.unshift(saved);
      if (supabaseEnabled) folioCounter = (parseInt(saved.folio, 10) || folioCounter) + 1;
      else localSaveData();
      document.getElementById('btnDescargar').style.display = 'inline-flex';
      document.getElementById('btnDescargar').onclick = () => descargarPDF(saved);
      renderStats();
      toast(`Formato guardado con folio ${saved.folio}.`, 'success');
    } catch (error) {
      toast('No se pudo guardar el formato: ' + error.message, 'error');
    }
  };
  try { guardarFormato = window.guardarFormato; } catch (_) {}

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const hasSupabase = await ensureSupabase();
      if (hasSupabase && currentUser) {
        await loadData();
        showApp();
        initApp();
      }
    } catch (error) {
      toast('Error al inicializar Supabase: ' + error.message, 'error');
    }
  });
})();
