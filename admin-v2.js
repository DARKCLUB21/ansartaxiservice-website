"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const API = String(window.ANSAR_CONFIG?.API_BASE_URL || "").replace(/\/+$/, "");
  const els = {
    loginPanel:$("loginPanel"), loginForm:$("loginForm"), username:$("username"),
    password:$("password"), loginMessage:$("loginMessage"), dashboard:$("dashboard"),
    adminHeader:$("adminHeader"), logoutBtn:$("logoutBtn"), refreshBtn:$("refreshBtn"),
    total:$("totalCount"), pending:$("pendingCount"), confirmed:$("confirmedCount"),
    rejected:$("rejectedCount"), filters:$("filters"), searchForm:$("searchForm"),
    searchInput:$("searchInput"), clearSearch:$("clearSearch"), message:$("dashboardMessage"),
    list:$("bookingList"), prev:$("prevBtn"), next:$("nextBtn"), page:$("pageLabel"),
    dialog:$("bookingDialog"), dialogId:$("dialogBookingId"), close:$("closeDialog"),
    details:$("bookingDetails"), whatsapp:$("customerWhatsApp"), actions:$("adminActions"),
    note:$("adminNote"), confirm:$("confirmBtn"), reject:$("rejectBtn"),
    history:$("bookingHistory"), dialogMessage:$("dialogMessage")
  };
  const PAGE_SIZE = 25;
  let token = sessionStorage.getItem("ansar_admin_v2_token") || "";
  let statusFilter = "";
  let search = "";
  let offset = 0;
  let activeBooking = null;

  function showMessage(el, msg="", error=false) {
    el.textContent = msg;
    el.classList.toggle("error", error);
  }
  function loggedIn(value) {
    els.loginPanel.hidden = value;
    els.dashboard.hidden = !value;
    els.adminHeader.hidden = !value;
  }
  function logout() {
    token = "";
    sessionStorage.removeItem("ansar_admin_v2_token");
    activeBooking = null;
    loggedIn(false);
    els.password.value = "";
    showMessage(els.loginMessage, "Please sign in.");
    if (els.dialog.open) els.dialog.close();
  }
  async function api(path, options={}) {
    if (!API) throw new Error("API URL missing in config.js.");
    const headers = new Headers(options.headers || {});
    headers.set("Accept","application/json");
    if (token) headers.set("Authorization",`Bearer ${token}`);
    if (options.body) headers.set("Content-Type","application/json");
    const response = await fetch(`${API}${path}`,{...options,headers});
    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please sign in again.");
    }
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(typeof data.detail==="string" ? data.detail : `Request failed (${response.status})`);
    return data;
  }
  function make(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className=cls;
    if (value!==undefined) node.textContent=value;
    return node;
  }
  function date(value) {
    if (!value) return "—";
    const d=new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime())?value:d.toLocaleDateString("en-IN");
  }
  function time(value) {
    if (!value) return "—";
    const [h,m]=value.split(":");
    const d=new Date();
    d.setHours(Number(h),Number(m),0,0);
    return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
  }
  async function loadStats() {
    const s=await api("/api/admin/stats");
    els.total.textContent=s.total ?? 0;
    els.pending.textContent=s.pending ?? 0;
    els.confirmed.textContent=s.confirmed ?? 0;
    els.rejected.textContent=s.rejected ?? 0;
  }
  async function loadBookings() {
    showMessage(els.message,"Loading bookings...");
    els.list.replaceChildren();
    try {
      const params=new URLSearchParams({limit:String(PAGE_SIZE),offset:String(offset)});
      if(statusFilter) params.set("status",statusFilter);
      if(search) params.set("search",search);
      const [bookings]=await Promise.all([
        api(`/api/admin/bookings?${params}`),loadStats()
      ]);
      if(!Array.isArray(bookings)) throw new Error("Unexpected booking response.");
      if(!bookings.length) els.list.append(make("p","empty","No bookings found."));
      bookings.forEach(b=>{
        const card=make("article","booking-card");
        const info=make("div","");
        info.append(make("h3","",b.booking_id));
        info.append(make("p","",`${b.customer_name} · ${b.customer_phone}`));
        info.append(make("p","",`${b.pickup} → ${b.destination}`));
        info.append(make("p","",`${date(b.travel_date)} · ${time(b.travel_time)} · ${b.vehicle}`));
        const badge=make("span",`status ${b.status}`,b.status);
        const button=make("button","btn btn-light","View details");
        button.type="button";
        button.addEventListener("click",()=>openBooking(b.booking_id));
        const right=make("div","");
        right.append(badge,button);
        card.append(info,right);
        els.list.append(card);
      });
      els.prev.disabled=offset===0;
      els.next.disabled=bookings.length<PAGE_SIZE;
      els.page.textContent=`Page ${Math.floor(offset/PAGE_SIZE)+1}`;
      showMessage(els.message,`${bookings.length} booking(s) loaded.`);
    } catch(e) {
      showMessage(els.message,e.message,true);
    }
  }
  function addDetail(label,value) {
    const item=make("div","detail");
    item.append(make("span","",label),make("strong","",String(value ?? "—")));
    els.details.append(item);
  }
  async function openBooking(id) {
    showMessage(els.dialogMessage,"Loading details...");
    els.details.replaceChildren();
    els.history.textContent="Loading history...";
    try {
      const b=await api(`/api/admin/bookings/${encodeURIComponent(id)}`);
      activeBooking=b;
      els.dialogId.textContent=b.booking_id;
      [
        ["Customer",b.customer_name],["Phone",b.customer_phone],
        ["Service",b.service],["Pickup",b.pickup],["Destination",b.destination],
        ["Travel date",date(b.travel_date)],["Travel time",time(b.travel_time)],
        ["Trip type",b.trip_type],["Vehicle",b.vehicle],["Passengers",b.passengers],
        ["Distance",b.distance_km==null?"Not available":`${b.distance_km} km`],
        ["Estimated fare",b.estimated_fare==null?"To be confirmed":`₹${b.estimated_fare}`],
        ["Status",b.status],["Admin note",b.admin_note]
      ].forEach(([k,v])=>addDetail(k,v));
      const phone=String(b.customer_phone||"").replace(/\D/g,"");
      els.whatsapp.href=phone?`https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${b.customer_name}, regarding your ANSAR TAXI booking ${b.booking_id}.`)}`:"#";
      els.whatsapp.hidden=!phone;
      els.actions.hidden=b.status!=="Pending";
      els.note.value=b.admin_note||"";
      const history=await api(`/api/admin/bookings/${encodeURIComponent(id)}/history`);
      els.history.replaceChildren();
      if(!Array.isArray(history)||!history.length) {
        els.history.append(make("p","empty","No status changes recorded."));
      } else history.forEach(entry=>{
        const item=make("div","history-item");
        item.append(make("strong","",`${entry.old_status||"New"} → ${entry.new_status}`));
        item.append(make("p","",entry.admin_note||"No admin note"));
        item.append(make("small","",`${entry.changed_by||"Admin"} · ${entry.created_at||""}`));
        els.history.append(item);
      });
      showMessage(els.dialogMessage);
      if(!els.dialog.open) els.dialog.showModal();
    } catch(e) {
      showMessage(els.dialogMessage,e.message,true);
      if(!els.dialog.open) els.dialog.showModal();
    }
  }
  async function updateStatus(status) {
    if(!activeBooking) return;
    const buttons=[els.confirm,els.reject];
    buttons.forEach(b=>b.disabled=true);
    showMessage(els.dialogMessage,"Saving booking status...");
    try {
      await api(`/api/admin/bookings/${encodeURIComponent(activeBooking.booking_id)}`,{
        method:"PATCH",
        body:JSON.stringify({status,admin_note:els.note.value.trim()||null})
      });
      await loadBookings();
      await openBooking(activeBooking.booking_id);
      showMessage(els.dialogMessage,`Booking ${status.toLowerCase()} successfully.`);
    } catch(e) {
      showMessage(els.dialogMessage,e.message,true);
    } finally {
      buttons.forEach(b=>b.disabled=false);
    }
  }
  els.loginForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const button=els.loginForm.querySelector('[type="submit"]');
    button.disabled=true;
    showMessage(els.loginMessage,"Signing in...");
    try {
      const data=await api("/api/admin/login",{
        method:"POST",
        body:JSON.stringify({username:els.username.value.trim(),password:els.password.value})
      });
      if(!data.access_token) throw new Error("No access token returned.");
      token=data.access_token;
      sessionStorage.setItem("ansar_admin_v2_token",token);
      els.password.value="";
      loggedIn(true);
      offset=0;
      await loadBookings();
    } catch(e) {
      showMessage(els.loginMessage,e.message,true);
    } finally { button.disabled=false; }
  });
  els.logoutBtn.addEventListener("click",logout);
  els.refreshBtn.addEventListener("click",loadBookings);
  els.filters.addEventListener("click",e=>{
    const button=e.target.closest("[data-status]");
    if(!button) return;
    statusFilter=button.dataset.status;
    offset=0;
    els.filters.querySelectorAll("[data-status]").forEach(x=>x.classList.toggle("active",x===button));
    loadBookings();
  });
  els.searchForm.addEventListener("submit",e=>{
    e.preventDefault();
    search=els.searchInput.value.trim();
    offset=0;
    loadBookings();
  });
  els.clearSearch.addEventListener("click",()=>{
    els.searchInput.value="";
    search="";
    offset=0;
    loadBookings();
  });
  els.prev.addEventListener("click",()=>{offset=Math.max(0,offset-PAGE_SIZE);loadBookings();});
  els.next.addEventListener("click",()=>{offset+=PAGE_SIZE;loadBookings();});
  els.close.addEventListener("click",()=>els.dialog.close());
  els.confirm.addEventListener("click",()=>updateStatus("Confirmed"));
  els.reject.addEventListener("click",()=>updateStatus("Rejected"));

  loggedIn(false);
  if(token) {
    loggedIn(true);
    loadBookings();
  }
})();
