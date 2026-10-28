// Szklana kula z płynem (ekran Dziś): poziom płynu = wynik dnia, warstwy w kolorach zaliczonych gwiazd (od dna),
// fale, bąbelki, przechylenie telefonu przelewa płyn (żyroskop po pierwszym stuknięciu – iOS pyta o zgodę),
// stuknięcie chlupie. Rysowanie na <canvas>; animacja tylko, gdy kula jest na ekranie i apka na wierzchu,
// po uspokojeniu płynu zostaje wolne falowanie. prefers-reduced-motion: obraz statyczny.
// Użycie: const k = utworzKule(canvas); k.ustaw([{ kolor: "#7AA2FF", h: 0.25 }, ...]) – h jako ułamek średnicy.
// k.ustawZloto(true, seria): dzień na 100% – płyn płynnie przechodzi w złoto, w powietrzu kuli migoczą złote iskry,
// po obręczy wędruje błysk; dłuższa seria dni na 100% = więcej iskier i mocniejsze światło (klasa .zlota i --kula-swiecenie na rodzicu).

const KULA_CICHO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function utworzKule(canvas, podpisEl) {
  const ctx = canvas.getContext("2d");
  const ROZMIAR = 248, R = 104, SX = ROZMIAR / 2, SY = ROZMIAR / 2 - 4;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = ROZMIAR * dpr;
  canvas.height = ROZMIAR * dpr;

  let warstwy = [];          // [{ klucz, kolor, h, cel, v, znika }] od dna
  let faza = 0;
  let amplituda = 3, amplitudaCel = 3;
  let przechyl = 0, przechylCel = 0;
  let babelki = [];
  let animuje = false, widoczna = true, pierwszeUstawienie = true;
  let zloto = false, zlotoT = 0, swiecenie = 0, iskry = [];
  const ZLOTE = [[245, 210, 122], [233, 184, 90], [255, 227, 161], [214, 160, 72]];

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function ku(k, t, cel) { return k.map(function (v, i) { return v + ((Array.isArray(cel) ? cel[i] : cel) - v) * t; }); }
  function css(k, a) { return "rgba(" + k.map(Math.round).join(",") + "," + (a == null ? 1 : a) + ")"; }
  // Kolor warstwy z uwzględnieniem przejścia w złoto (każda warstwa w swoim odcieniu złota)
  function kolorWarstwy(w, i) { return ku(rgb(w.kolor), zlotoT, ZLOTE[i % ZLOTE.length]); }
  function poziom() { return warstwy.reduce(function (s, w) { return s + w.h; }, 0); }
  function nowyBabelek() {
    return { x: SX + (Math.random() - 0.5) * R * 1.4, y: SY + R - Math.random() * 20, r: 1 + Math.random() * 2.6, v: 0.4 + Math.random() * 1.1, dryf: Math.random() * 6.28 };
  }
  // Iskra: złoty błysk w płynie (przy 100% kula jest pełna), unosi się powoli i gaśnie
  function nowaIskra() {
    return { x: SX + (Math.random() - 0.5) * R * 1.4, y: SY + R * 0.85 - Math.random() * R * 1.5, r: 1.2 + Math.random() * 2.2,
      v: 0.15 + Math.random() * 0.45, faza: Math.random() * 6.28, zycie: 0, tempo: 0.006 + Math.random() * 0.008 };
  }
  function chlup(sila, ile) {
    if (KULA_CICHO) return;
    amplitudaCel = sila;
    setTimeout(function () { amplitudaCel = 3; }, 330);
    for (let i = 0; i < ile; i++) babelki.push(nowyBabelek());
    start();
  }

  // Obszar pod falującą, przechyloną linią na wysokości y0
  function sciezkaFali(y0, amp, przesuniecie) {
    ctx.beginPath();
    ctx.moveTo(SX - R - 2, SY + R + 2);
    for (let x = SX - R - 2; x <= SX + R + 2; x += 3) {
      ctx.lineTo(x, y0 + Math.tan(przechyl) * (x - SX) +
        amp * Math.sin(x * 0.045 + faza + przesuniecie) + amp * 0.45 * Math.sin(x * 0.083 - faza * 1.3 + przesuniecie));
    }
    ctx.lineTo(SX + R + 2, SY + R + 2);
    ctx.closePath();
  }

  function rysuj() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ROZMIAR, ROZMIAR);
    const calosc = poziom();
    const widoczne = warstwy.filter(function (w) { return w.h > 0.002; });
    const wierzch = widoczne[widoczne.length - 1];
    const kolorPoswiaty = wierzch ? (zlotoT > 0.5 ? "#F2C66D" : wierzch.kolor) : "transparent";
    if (canvas._poswiata !== kolorPoswiaty) {
      canvas._poswiata = kolorPoswiaty;
      canvas.parentNode.style.setProperty("--kula-poswiata", kolorPoswiaty);
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(SX, SY, R, 0, Math.PI * 2);
    ctx.clip();
    const wn = ctx.createRadialGradient(SX - R * 0.3, SY - R * 0.4, R * 0.1, SX, SY, R);
    wn.addColorStop(0, "rgba(255,255,255,0.07)");
    wn.addColorStop(1, "rgba(255,255,255,0.015)");
    ctx.fillStyle = wn;
    ctx.fillRect(SX - R, SY - R, R * 2, R * 2);

    // Warstwy od wierzchu w dół: każda wypełnia wszystko pod swoją linią, niższa przykrywa dół wyższej
    let wysokosc = calosc;
    for (let i = warstwy.length - 1; i >= 0; i--) {
      const w = warstwy[i];
      if (w.h > 0.001) {
        const y0 = SY + R - wysokosc * 2 * R;
        const gorna = w === wierzch;
        const amp = gorna ? amplituda : amplituda * 0.35;
        const k = kolorWarstwy(w, i);
        if (gorna) {
          sciezkaFali(y0 - 2, amp * 0.8, 2.1);
          ctx.fillStyle = css(k, 0.33);
          ctx.fill();
        }
        sciezkaFali(y0, amp, i * 0.9);
        const g = ctx.createLinearGradient(0, y0 - amp, 0, Math.min(SY + R, y0 + w.h * 2 * R + 6));
        g.addColorStop(0, css(ku(k, 0.45, 255)));
        g.addColorStop(0.35, css(k));
        g.addColorStop(1, css(ku(k, 0.35, 10)));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = gorna ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = gorna ? 1.4 : 0.8;
        ctx.stroke();
      }
      wysokosc -= w.h;
    }

    // Światło w płynie: jasny pas pod powierzchnią i poświata od środka, przycięte do płynu
    if (calosc > 0.01 && wierzch) {
      const yp = SY + R - calosc * 2 * R;
      ctx.save();
      sciezkaFali(yp, amplituda, warstwy.indexOf(wierzch) * 0.9);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const pas = ctx.createLinearGradient(0, yp - 8, 0, yp + 26);
      pas.addColorStop(0, "rgba(255,255,255,0.22)");
      pas.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = pas;
      ctx.fillRect(SX - R, yp - R * 0.6, R * 2, R * 0.6 + 30);
      const srodek = ctx.createRadialGradient(SX + Math.sin(faza * 0.3) * 18, SY + R * 0.45, 0, SX, SY + R * 0.45, R * 0.9);
      srodek.addColorStop(0, "rgba(255,255,255,0.16)");
      srodek.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = srodek;
      ctx.fillRect(SX - R, yp, R * 2, SY + R - yp);
      ctx.restore();
      const gl = ctx.createLinearGradient(0, SY - R, 0, SY + R);
      gl.addColorStop(0, "rgba(5,6,8,0)");
      gl.addColorStop(1, "rgba(5,6,8,0.3)");
      ctx.fillStyle = gl;
      ctx.fillRect(SX - R, SY - R, R * 2, R * 2);
    }
    const brzeg = ctx.createRadialGradient(SX, SY, R * 0.62, SX, SY, R);
    brzeg.addColorStop(0, "rgba(5,6,8,0)");
    brzeg.addColorStop(1, "rgba(5,6,8,0.45)");
    ctx.fillStyle = brzeg;
    ctx.fillRect(SX - R, SY - R, R * 2, R * 2);

    const powierzchnia = SY + R - calosc * 2 * R;
    babelki.forEach(function (b) {
      if (b.y < powierzchnia + 4) return;
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(b.dryf) * 2, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    });
    // Złote iskry: czteroramienne błyski unoszące się w płynie
    iskry.forEach(function (s) {
      const a = s.zycie < 0.2 ? s.zycie / 0.2 : s.zycie > 0.8 ? (1 - s.zycie) / 0.2 : 1;
      const r = s.r * (0.6 + 0.4 * Math.sin(s.faza));
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = a * zlotoT;
      ctx.fillStyle = "#FFE7A8";
      ctx.shadowColor = "#F2C66D";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -r * 2);
      ctx.quadraticCurveTo(r * 0.25, -r * 0.25, r * 2, 0);
      ctx.quadraticCurveTo(r * 0.25, r * 0.25, 0, r * 2);
      ctx.quadraticCurveTo(-r * 0.25, r * 0.25, -r * 2, 0);
      ctx.quadraticCurveTo(-r * 0.25, -r * 0.25, 0, -r * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Szkło: obręcz (przy złocie z wędrującym błyskiem), odblask w lewym górnym rogu, refleks u dołu
    ctx.beginPath();
    ctx.arc(SX, SY, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (zlotoT > 0.01) {
      const kat = faza * 0.35;
      ctx.beginPath();
      ctx.arc(SX, SY, R, kat, kat + 0.9);
      ctx.strokeStyle = "rgba(255, 226, 150," + (0.75 * zlotoT) + ")";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.shadowColor = "#F2C66D";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.save();
    ctx.translate(SX - R * 0.42, SY - R * 0.5);
    ctx.rotate(-0.6);
    ctx.scale(1, 0.5);
    const od = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
    od.addColorStop(0, "rgba(255,255,255,0.42)");
    od.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = od;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(SX, SY, R - 5, Math.PI * 0.18, Math.PI * 0.82);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Fizyka klatki: sprężyna wysokości warstw, wygaszanie fali, wygładzone przechylenie, bąbelki
  function krok() {
    warstwy.forEach(function (w) {
      w.v = (w.v + (w.cel - w.h) * 0.06) * 0.84;
      w.h += w.v;
      if (w.h < 0) { w.h = 0; w.v = 0; }
    });
    warstwy = warstwy.filter(function (w) { return !(w.znika && w.h <= 0.0005); });
    amplituda += (amplitudaCel - amplituda) * 0.08;
    zlotoT += ((zloto ? 1 : 0) - zlotoT) * 0.035;
    if (Math.abs((zloto ? 1 : 0) - zlotoT) < 0.002) zlotoT = zloto ? 1 : 0;
    // Nowe iskry, gdy kula jest złota: ich liczba rośnie z serią dni na 100%
    if (zloto && iskry.length < 6 + swiecenie * 14 && Math.random() < 0.18) iskry.push(nowaIskra());
    iskry = iskry.filter(function (s) {
      s.zycie += s.tempo;
      s.y -= s.v;
      s.x += Math.sin(s.faza) * 0.25;
      s.faza += 0.12;
      return s.zycie < 1 && s.y > SY - R + 4;
    });

    przechyl += (przechylCel - przechyl) * 0.08;
    faza += 0.045;
    const powierzchnia = SY + R - poziom() * 2 * R;
    babelki = babelki.filter(function (b) {
      b.y -= b.v;
      b.dryf += 0.08;
      return b.y >= powierzchnia;
    });
  }

  function klatka() {
    if (!widoczna || document.hidden || !canvas.isConnected) { animuje = false; return; }
    krok();
    rysuj();
    requestAnimationFrame(klatka);
  }
  function start() {
    if (KULA_CICHO) {
      warstwy = warstwy.filter(function (w) { return !w.znika; });
      warstwy.forEach(function (w) { w.h = w.cel; w.v = 0; });
      zlotoT = zloto ? 1 : 0;
      rysuj();
      return;
    }
    if (!animuje && widoczna && !document.hidden) {
      animuje = true;
      requestAnimationFrame(klatka);
    }
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (wpisy) { widoczna = wpisy[0].isIntersecting; start(); }).observe(canvas);
  }
  document.addEventListener("visibilitychange", start);

  // Przechylenie: żyroskop po stuknięciu (iOS: zgoda), na komputerze kursor nad kulą
  let zyroskop = false;
  function naOrientacje(e) {
    if (e.gamma == null) return;
    przechylCel = Math.max(-0.45, Math.min(0.45, -e.gamma * Math.PI / 180 * 0.9));
  }
  function wlaczZyroskop() {
    if (zyroskop || KULA_CICHO || !window.DeviceOrientationEvent) return;
    const D = window.DeviceOrientationEvent;
    if (typeof D.requestPermission === "function") {
      D.requestPermission().then(function (z) {
        if (z === "granted") { zyroskop = true; window.addEventListener("deviceorientation", naOrientacje); }
      }).catch(function () {});
    } else {
      zyroskop = true;
      window.addEventListener("deviceorientation", naOrientacje);
    }
  }
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect();
    przechylCel = ((e.clientX - r.left) / r.width - 0.5) * -0.7;
    start();
  });
  canvas.addEventListener("pointerleave", function () { if (!zyroskop) przechylCel = 0; });
  canvas.addEventListener("click", function () {
    wlaczZyroskop();
    if (podpisEl) podpisEl.classList.remove("widoczny");
    chlup(12, 8);
  });
  if (podpisEl && !KULA_CICHO && window.DeviceOrientationEvent && window.matchMedia("(pointer: coarse)").matches) {
    setTimeout(function () { if (!zyroskop) podpisEl.classList.add("widoczny"); }, 2200);
  }

  rysuj();

  return {
    // Dzień na 100%: złoto i iskry; seria dni na 100% wzmacnia światło (0–1 przy 7+ dniach)
    ustawZloto: function (wl, seria) {
      const bylo = zloto;
      zloto = !!wl;
      swiecenie = zloto ? Math.min(1, Math.max(0, (seria || 1) - 1) / 6) : 0;
      const box = canvas.parentNode;
      box.classList.toggle("zlota", zloto);
      box.style.setProperty("--kula-swiecenie", swiecenie.toFixed(2));
      if (zloto && !bylo && !KULA_CICHO) {
        chlup(16, 20);
        for (let i = 0; i < 10; i++) iskry.push(nowaIskra());
      }
      start();
    },
    // Warstwy dopasowane po kluczu: nowe dolewane od zera (z falą i bąbelkami), zabrane spływają i znikają
    ustaw: function (lista) {
      const stare = warstwy;
      let zmiana = false;
      const nowe = lista.map(function (d) {
        const w = stare.find(function (x) { return x.klucz === d.klucz && !x.znika; });
        if (w) {
          if (Math.abs(w.cel - d.h) > 0.0001) zmiana = true;
          w.cel = d.h;
          w.kolor = d.kolor;
          return w;
        }
        zmiana = true;
        return { klucz: d.klucz, kolor: d.kolor, h: 0, cel: d.h, v: 0 };
      });
      stare.forEach(function (w) {
        if (nowe.indexOf(w) < 0) {
          if (!w.znika) zmiana = true;
          w.cel = 0;
          w.znika = true;
          nowe.push(w);
        }
      });
      warstwy = nowe;
      if (zmiana && !pierwszeUstawienie) chlup(14, 14);
      if (lista.length) pierwszeUstawienie = false;
      start();
    }
  };
}
