// Headless functional test of the app's API flow (same endpoints/logic as index.html)
const KMB = "https://data.etabus.gov.hk/v1/transport/kmb";
const CTB = "https://rt.data.gov.hk/v2/transport/citybus";
const jget = async (u) => {
  const r = await fetch(u, { headers: { "User-Agent": "bus-eta-selftest" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + u);
  return r.json();
};

(async () => {
  const fail = [];
  const ok = (m) => console.log("PASS " + m);
  const bad = (m) => { console.log("FAIL " + m); fail.push(m); };

  // 1) KMB route index
  const rl = (await jget(KMB + "/route/")).data;
  ok(`KMB route index: ${rl.length} entries`);
  const route968 = rl.filter(x => x.route === "968");
  ok(`968 variants: ${route968.length} -> ${route968.map(x => x.bound + "/" + x.service_type).join(",")}`);

  // 2) search logic
  const q = "968";
  const seen = {}, out = [];
  rl.forEach(r => { if (r.route !== q) return; const k = r.route + "|" + r.bound; if (seen[k]) return; seen[k] = 1;
    out.push({ co: "KMB", route: r.route, bound: r.bound, st: String(r.service_type), orig: r.orig_tc, dest: r.dest_tc }); });
  ok(`search 968 -> ${out.length} variants: ` + out.map(o => o.bound + " " + o.orig + "→" + o.dest).join(" | "));

  // 3) route-stop + stop names
  const rs = (await jget(KMB + "/route-stop/968/outbound/1")).data;
  const stops = (await jget(KMB + "/stop")).data;
  const map = {}; stops.forEach(s => map[s.stop] = s.name_tc);
  ok(`968 outbound stops: ${rs.length}; first=${map[rs[0].stop]} last=${map[rs[rs.length - 1].stop]}`);
  if (rs.length < 10) bad("stops too few");

  // 4) ETA for a mid-route stop
  const pick = rs[5];
  const et = (await jget(`${KMB}/eta/${pick.stop}/968/1`)).data;
  ok(`ETA at ${map[pick.stop]}: ${et.length} entries; first=${JSON.stringify({ dir: et[0] && et[0].dir, eta: et[0] && et[0].eta, rmk: et[0] && et[0].rmk_tc, dest: et[0] && et[0].dest_tc })}`);
  const mins = et.map(x => x.eta ? Math.round((Date.parse(x.eta) - Date.now()) / 60000) : null);
  console.log("     countdown minutes:", JSON.stringify(mins));
  if (et.length && typeof mins[0] !== "number") bad("no usable ETA");

  // 5) CTB flow
  const cr = (await jget(CTB + "/route/CTB/720")).data;
  ok(`CTB 720: ${cr.orig_tc} → ${cr.dest_tc}`);
  const cio = (await jget(CTB + "/route-stop/CTB/720/outbound")).data;
  const cii = (await jget(CTB + "/route-stop/CTB/720/inbound")).data;
  const s1 = (await jget(CTB + "/stop/" + cio[0].stop)).data;
  const s2 = (await jget(CTB + "/stop/" + cii[0].stop)).data;
  ok(`CTB 720 stops: out=${cio.length} in=${cii.length}; in orig=${s2.name_tc}`);
  const cet = (await jget(`${CTB}/eta/CTB/${cio[3].stop}/720`)).data;
  console.log(`     CTB ETA at ${s1.name_tc}: ${cet.length} entries`, cet[0] ? JSON.stringify({ dir: cet[0].dir, eta: cet[0].eta, rmk: cet[0].rmk_tc }) : "(no bus now)");

  // 6) citybus/nwfb alias check (前新巴路線 e.g. 970)
  try {
    const n = (await jget(CTB + "/route/CTB/970")).data;
    ok(`CTB 970: ${n.orig_tc} → ${n.dest_tc}`);
  } catch (e) { console.log("INFO 970 lookup: " + e.message); }

  console.log(fail.length ? "\nRESULT: FAIL " + fail.length : "\nRESULT: ALL PASS");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.log("FATAL " + e.message); process.exit(2); });
