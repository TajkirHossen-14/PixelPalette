(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } }
  };

  const state = {
    hex: "#7C3AED", hue: 262, saturation: 83, value: 93,
    paletteType: "complementary", palette: [],
    recents: storage.get("pixelpalette-recents", []),
    favorites: storage.get("pixelpalette-favorites", [])
  };

  const colorNames = [
    ["Midnight", "#191970"], ["Navy Blue", "#000080"], ["Royal Blue", "#4169E1"],
    ["Sky Blue", "#38BDF8"], ["Aqua", "#00FFFF"], ["Ocean Teal", "#0D9488"],
    ["Emerald", "#10B981"], ["Forest Green", "#228B22"], ["Lime", "#84CC16"],
    ["Sunflower", "#FACC15"], ["Golden Amber", "#F59E0B"], ["Tangerine", "#F97316"],
    ["Coral Red", "#FF5A5F"], ["Crimson", "#DC143C"], ["Ruby", "#E11D48"],
    ["Rose Pink", "#F43F5E"], ["Hot Pink", "#EC4899"], ["Magenta", "#D946EF"],
    ["Electric Violet", "#7C3AED"], ["Deep Purple", "#581C87"], ["Lavender", "#C4B5FD"],
    ["Chocolate", "#7C2D12"], ["Caramel", "#B45309"], ["Sand", "#D6B98C"],
    ["Snow White", "#FFFFFF"], ["Pearl Gray", "#D1D5DB"], ["Slate", "#64748B"],
    ["Charcoal", "#374151"], ["Ink Black", "#111827"], ["Mint", "#A7F3D0"]
  ];

  const els = {
    visual: $("#visual-picker"), thumb: $("#picker-thumb"), hue: $("#hue-slider"), native: $("#native-color"),
    hexForm: $("#hex-entry-form"), hexInput: $("#hex-input"), hexFeedback: $("#hex-feedback"),
    preview: $("#preview-swatch"), previewHex: $("#preview-hex"), name: $("#color-name"),
    swatches: $("#palette-swatches"), recents: $("#recent-colors"), saved: $("#saved-palettes"),
    toast: $("#toast"), favorite: $("#favorite-button")
  };

  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
  function componentToHex(value) { return Math.round(value).toString(16).padStart(2, "0"); }
  function rgbToHex(r, g, b) { return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase(); }
  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = parseInt(clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h, s: max ? (delta / max) * 100 : 0, v: max * 100 };
  }
  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r,g,b] = [c,x,0]; else if (h < 120) [r,g,b] = [x,c,0];
    else if (h < 180) [r,g,b] = [0,c,x]; else if (h < 240) [r,g,b] = [0,x,c];
    else if (h < 300) [r,g,b] = [x,0,c]; else [r,g,b] = [c,0,x];
    return { r: (r+m)*255, g: (g+m)*255, b: (b+m)*255 };
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2*l - 1))*s, x = c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
    let r=0,g=0,b=0;
    if(h<60)[r,g,b]=[c,x,0]; else if(h<120)[r,g,b]=[x,c,0]; else if(h<180)[r,g,b]=[0,c,x];
    else if(h<240)[r,g,b]=[0,x,c]; else if(h<300)[r,g,b]=[x,0,c]; else [r,g,b]=[c,0,x];
    return rgbToHex((r+m)*255,(g+m)*255,(b+m)*255);
  }
  function normalizeHue(h) { return (h % 360 + 360) % 360; }
  function readableText(hex) { const {r,g,b}=hexToRgb(hex); return (r*299+g*587+b*114)/1000 > 145 ? "#17151F" : "#FFFFFF"; }

  function nearestName(hex) {
    const target = hexToRgb(hex); let best = colorNames[0], distance = Infinity;
    colorNames.forEach(entry => {
      const rgb = hexToRgb(entry[1]);
      const d = (target.r-rgb.r)**2 + (target.g-rgb.g)**2 + (target.b-rgb.b)**2;
      if (d < distance) { distance = d; best = entry; }
    });
    return best[0];
  }

  function showToast(message, icon = "check-circle-2") {
    els.toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
    if (window.lucide) lucide.createIcons();
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1900);
  }

  async function copyText(text, message = "Copied!") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
      document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
    }
    showToast(message);
  }

  function paletteFor(hex, type) {
    const {r,g,b} = hexToRgb(hex), base = rgbToHsl(r,g,b), make = (h,s,l) => hslToHex(normalizeHue(h),clamp(s,8,96),clamp(l,8,94));
    if (type === "analogous") return [-60,-30,0,30,60].map((d,i) => make(base.h+d, base.s + (i-2)*2, base.l));
    if (type === "triadic") return [0,120,240,60,180].map((d,i) => make(base.h+d, base.s, clamp(base.l + (i>2?8:0),8,94)));
    if (type === "monochromatic") return [-25,-13,0,13,25].map(d => make(base.h, base.s, clamp(base.l+d,8,94)));
    return [make(base.h,base.s,clamp(base.l-14,8,94)), hex, make(base.h,base.s,clamp(base.l+14,8,94)), make(base.h+180,base.s,base.l), make(base.h+180,clamp(base.s-20,8,96),clamp(base.l+12,8,94))];
  }

  function renderPalette() {
    state.palette = paletteFor(state.hex, state.paletteType);
    els.swatches.innerHTML = state.palette.map((hex, index) => `<button class="palette-swatch" style="background:${hex};color:${readableText(hex)}" data-color="${hex}" aria-label="Use and copy color ${hex}"><span>${hex}</span></button>`).join("");
    updateFavoriteButton();
  }

  function setColor(hex, options = {}) {
    const normalized = rgbToHex(...Object.values(hexToRgb(hex)));
    const rgb = hexToRgb(normalized), hsl = rgbToHsl(rgb.r,rgb.g,rgb.b), hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);
    state.hex = normalized; state.hue = hsv.h; state.saturation = hsv.s; state.value = hsv.v;
    document.documentElement.style.setProperty("--accent", normalized);
    document.documentElement.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    document.documentElement.style.setProperty("--hue", Math.round(hsv.h));
    els.visual.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl(${hsv.h},100%,50%)`;
    els.thumb.style.left = `${hsv.s}%`; els.thumb.style.top = `${100-hsv.v}%`;
    els.hue.value = hsv.h; els.native.value = normalized.toLowerCase();
    if (document.activeElement !== els.hexInput) els.hexInput.value = normalized.slice(1);
    els.preview.style.background = normalized; els.preview.style.color = readableText(normalized);
    els.previewHex.textContent = normalized; els.name.textContent = nearestName(normalized);
    $("#hex-value").textContent = normalized;
    $("#rgb-value").textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    $("#rgba-value").textContent = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
    $("#hsl-value").textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    $("meta[name='theme-color']").content = normalized;
    $("#gradient-color-one").value = normalized.toLowerCase();
    $("#contrast-background").value = normalized.toLowerCase();
    updateGradient(); updateContrast(); renderPalette();
    if (options.save) addRecent(normalized);
  }

  function setFromHsv(save = false) {
    const rgb = hsvToRgb(state.hue,state.saturation,state.value);
    setColor(rgbToHex(rgb.r,rgb.g,rgb.b), {save});
  }

  function addRecent(hex) {
    state.recents = [hex, ...state.recents.filter(color => color !== hex)].slice(0, 12);
    storage.set("pixelpalette-recents", state.recents); renderRecents();
  }
  function renderRecents() {
    els.recents.innerHTML = state.recents.length ? state.recents.map(hex => `<button class="mini-swatch" style="background:${hex}" data-color="${hex}" aria-label="Use recent color ${hex}" title="${hex}"></button>`).join("") : '<p class="empty-state">Your recent colors will appear here.</p>';
  }

  function favoriteKey(colors = state.palette) { return colors.join("-"); }
  function updateFavoriteButton() {
    const saved = state.favorites.some(item => favoriteKey(item.colors) === favoriteKey());
    els.favorite.classList.toggle("saved", saved);
    els.favorite.innerHTML = `<i data-lucide="heart" ${saved ? 'fill="currentColor"' : ""}></i><span>${saved ? "Saved" : "Save"}</span>`;
    if (window.lucide) lucide.createIcons();
  }
  function renderFavorites() {
    $("#favorites-count").textContent = `${state.favorites.length} saved`;
    els.saved.innerHTML = state.favorites.length ? state.favorites.map(item => `<div class="saved-palette"><button class="saved-strip" data-id="${item.id}" aria-label="Load saved palette">${item.colors.map(c=>`<span style="background:${c}"></span>`).join("")}</button><button class="delete-saved" data-delete="${item.id}" aria-label="Delete saved palette"><i data-lucide="trash-2"></i></button></div>`).join("") : '<p class="empty-state">Save a palette to keep it close.</p>';
    if (window.lucide) lucide.createIcons();
  }

  function updateGradient() {
    const one = $("#gradient-color-one").value.toUpperCase(), two = $("#gradient-color-two").value.toUpperCase(), direction = $("#gradient-direction").value;
    const value = `linear-gradient(${direction}, ${one}, ${two})`;
    $("#gradient-preview").style.background = value; $("#gradient-code").textContent = `background: ${value};`;
    $("#gradient-one-label").textContent = one; $("#gradient-two-label").textContent = two;
  }
  function luminance(hex) {
    const {r,g,b}=hexToRgb(hex); const channels=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  }
  function updateContrast() {
    const fg=$("#contrast-foreground").value.toUpperCase(), bg=$("#contrast-background").value.toUpperCase();
    const l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    $("#contrast-demo").style.color=fg; $("#contrast-demo").style.background=bg;
    $("#foreground-label").textContent=fg; $("#background-label").textContent=bg; $("#contrast-ratio").textContent=`${ratio.toFixed(2)}:1`;
    const aa=ratio>=4.5, aaa=ratio>=7;
    setBadge($("#aa-badge"),aa,"AA"); setBadge($("#aaa-badge"),aaa,"AAA");
    $("#contrast-note").textContent = aaa ? "Excellent — passes AAA for normal and large text." : aa ? "Passes AA for normal text and AAA for large text." : ratio>=3 ? "Passes AA for large text only. Increase the contrast for body text." : "Does not meet WCAG text contrast. Try lighter or darker colors.";
  }
  function setBadge(el, pass, label) { el.className=pass?"pass":"fail"; el.innerHTML=`<i data-lucide="${pass?"check":"x"}"></i> ${label}`; if(window.lucide)lucide.createIcons(); }

  function pointerColor(event) {
    const rect=els.visual.getBoundingClientRect();
    state.saturation=clamp((event.clientX-rect.left)/rect.width)*100; state.value=(1-clamp((event.clientY-rect.top)/rect.height))*100;
    setFromHsv(false);
  }
  els.visual.addEventListener("pointerdown", event => { els.visual.setPointerCapture(event.pointerId); pointerColor(event); });
  els.visual.addEventListener("pointermove", event => { if(els.visual.hasPointerCapture(event.pointerId)) pointerColor(event); });
  els.visual.addEventListener("pointerup", () => addRecent(state.hex));
  els.visual.addEventListener("keydown", event => {
    const keys={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,2],ArrowDown:[0,-2]}; if(!keys[event.key])return;
    event.preventDefault(); state.saturation=clamp(state.saturation+keys[event.key][0],0,100); state.value=clamp(state.value+keys[event.key][1],0,100); setFromHsv(true);
  });
  els.hue.addEventListener("input", () => { state.hue=Number(els.hue.value); setFromHsv(false); });
  els.hue.addEventListener("change", () => addRecent(state.hex));
  els.native.addEventListener("input", () => setColor(els.native.value)); els.native.addEventListener("change", () => addRecent(state.hex));

  function applyManualHex() {
    const raw = els.hexInput.value.trim().replace(/^#/, "");
    if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      els.hexForm.classList.remove("valid"); els.hexForm.classList.add("invalid");
      els.hexInput.setAttribute("aria-invalid", "true");
      els.hexFeedback.textContent = "Enter a valid 3 or 6 digit HEX value.";
      return;
    }
    const expanded = raw.length === 3 ? raw.split("").map(char => char + char).join("") : raw;
    setColor(`#${expanded}`, {save:true});
    els.hexInput.value = expanded.toUpperCase();
    els.hexForm.classList.remove("invalid"); els.hexForm.classList.add("valid");
    els.hexInput.setAttribute("aria-invalid", "false");
    els.hexFeedback.textContent = "Color applied successfully.";
    showToast("HEX color applied", "palette");
    clearTimeout(applyManualHex.timer);
    applyManualHex.timer = setTimeout(() => {
      els.hexForm.classList.remove("valid");
      els.hexFeedback.textContent = "Enter a 3 or 6 digit HEX value.";
    }, 2200);
  }
  els.hexForm.addEventListener("submit", event => { event.preventDefault(); applyManualHex(); });
  els.hexInput.addEventListener("input", () => {
    els.hexInput.value = els.hexInput.value.replace(/[^#0-9a-f]/gi, "").slice(0, 7).toUpperCase();
    els.hexForm.classList.remove("invalid", "valid");
    els.hexInput.setAttribute("aria-invalid", "false");
    els.hexFeedback.textContent = "Enter a 3 or 6 digit HEX value.";
  });

  $("#surprise-button").addEventListener("click", () => {
    const hex=rgbToHex(Math.random()*255,Math.random()*255,Math.random()*255); setColor(hex,{save:true});
    state.paletteType=["complementary","analogous","triadic","monochromatic"][Math.floor(Math.random()*4)];
    $$(".palette-tab").forEach(tab=>{const active=tab.dataset.type===state.paletteType;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",active);}); renderPalette(); showToast("A fresh palette appeared!","sparkles");
  });
  $("#eyedropper-button").addEventListener("click", async () => {
    if (!("EyeDropper" in window)) { showToast("Eyedropper isn't supported here","circle-alert"); return; }
    try { const result=await new EyeDropper().open(); setColor(result.sRGBHex,{save:true}); showToast("Color picked from screen","pipette"); } catch { /* user cancelled */ }
  });

  $$(".copy-button").forEach(button=>button.addEventListener("click",()=>copyText($(`#${button.dataset.copyTarget}`).textContent)));
  $("#swatch-copy").addEventListener("click",()=>copyText(state.hex));
  els.swatches.addEventListener("click",event=>{const swatch=event.target.closest("[data-color]");if(swatch){setColor(swatch.dataset.color,{save:true});copyText(swatch.dataset.color,"Color copied & applied");}});
  els.recents.addEventListener("click",event=>{const swatch=event.target.closest("[data-color]");if(swatch)setColor(swatch.dataset.color,{save:true});});
  $("#clear-recents").addEventListener("click",()=>{state.recents=[];storage.set("pixelpalette-recents",[]);renderRecents();showToast("Recent colors cleared","trash-2");});
  $$(".palette-tab").forEach(tab=>tab.addEventListener("click",()=>{$$(".palette-tab").forEach(t=>{t.classList.remove("active");t.setAttribute("aria-selected","false")});tab.classList.add("active");tab.setAttribute("aria-selected","true");state.paletteType=tab.dataset.type;renderPalette();}));

  els.favorite.addEventListener("click",()=>{
    const key=favoriteKey(),existing=state.favorites.findIndex(item=>favoriteKey(item.colors)===key);
    if(existing>=0){state.favorites.splice(existing,1);showToast("Palette removed","heart");}else{state.favorites.unshift({id:Date.now(),colors:[...state.palette],type:state.paletteType});showToast("Palette saved","heart");}
    storage.set("pixelpalette-favorites",state.favorites);renderFavorites();updateFavoriteButton();
  });
  els.saved.addEventListener("click",event=>{
    const deleteButton=event.target.closest("[data-delete]");
    if(deleteButton){state.favorites=state.favorites.filter(item=>String(item.id)!==deleteButton.dataset.delete);storage.set("pixelpalette-favorites",state.favorites);renderFavorites();updateFavoriteButton();return;}
    const strip=event.target.closest("[data-id]"); if(strip){const item=state.favorites.find(p=>String(p.id)===strip.dataset.id);if(item){state.paletteType=item.type||"complementary";setColor(item.colors[1]||item.colors[0],{save:true});$$(".palette-tab").forEach(t=>t.classList.toggle("active",t.dataset.type===state.paletteType));showToast("Saved palette loaded","folder-open");}}
  });

  $("#copy-css-button").addEventListener("click",()=>copyText(`:root {\n${state.palette.map((c,i)=>`  --color-${i+1}: ${c};`).join("\n")}\n}`,"CSS variables copied"));
  $("#copy-json-button").addEventListener("click",()=>copyText(JSON.stringify({name:"PixelPalette",type:state.paletteType,colors:state.palette},null,2),"JSON copied"));
  $("#share-button").addEventListener("click",()=>{const url=new URL(location.href);url.search="";url.searchParams.set("palette",state.palette.join(",").replaceAll("#",""));url.searchParams.set("type",state.paletteType);history.replaceState({},"",url);copyText(url.href,"Share link copied");});
  $("#export-png-button").addEventListener("click",()=>{
    const canvas=$("#export-canvas"),ctx=canvas.getContext("2d");canvas.width=1400;canvas.height=800;
    ctx.fillStyle="#F8F7FB";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#17151F";ctx.font="700 64px Space Grotesk, sans-serif";ctx.fillText("PixelPalette",80,115);ctx.fillStyle="#716D7D";ctx.font="400 25px Inter, sans-serif";ctx.fillText(`${state.paletteType[0].toUpperCase()+state.paletteType.slice(1)} palette`,82,160);
    const width=248,gap=16,start=80;state.palette.forEach((color,i)=>{const x=start+i*(width+gap);ctx.fillStyle=color;roundRect(ctx,x,230,width,400,24);ctx.fill();ctx.fillStyle="#17151F";ctx.font="600 23px monospace";ctx.fillText(color,x,685);});
    const gradient=ctx.createLinearGradient(80,0,1320,0);state.palette.forEach((c,i)=>gradient.addColorStop(i/(state.palette.length-1),c));ctx.fillStyle=gradient;roundRect(ctx,80,720,1240,26,13);ctx.fill();
    const link=document.createElement("a");link.download=`pixelpalette-${Date.now()}.png`;link.href=canvas.toDataURL("image/png");link.click();showToast("Palette PNG downloaded","download");
  });
  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

  [$("#gradient-color-one"),$("#gradient-color-two"),$("#gradient-direction")].forEach(el=>el.addEventListener("input",updateGradient));
  $("#swap-gradient").addEventListener("click",()=>{const a=$("#gradient-color-one"),b=$("#gradient-color-two"),temp=a.value;a.value=b.value;b.value=temp;updateGradient();});
  $("#copy-gradient").addEventListener("click",()=>copyText($("#gradient-code").textContent,"Gradient CSS copied"));
  [$("#contrast-foreground"),$("#contrast-background")].forEach(el=>el.addEventListener("input",updateContrast));

  const savedTheme=storage.get("pixelpalette-theme",null); const dark=savedTheme?savedTheme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme=dark?"dark":"light";
  function updateThemeIcon(){const isDark=document.documentElement.dataset.theme==="dark";$("#theme-toggle").innerHTML=`<i data-lucide="${isDark?"sun":"moon"}"></i>`;$("#theme-toggle").setAttribute("aria-label",`Switch to ${isDark?"light":"dark"} mode`);if(window.lucide)lucide.createIcons();}
  $("#theme-toggle").addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;storage.set("pixelpalette-theme",next);updateThemeIcon();});

  function initFromUrl(){const params=new URLSearchParams(location.search),encoded=params.get("palette"),type=params.get("type");if(type&&["complementary","analogous","triadic","monochromatic"].includes(type))state.paletteType=type;if(encoded){const first=encoded.split(",")[0];if(/^[0-9a-f]{6}$/i.test(first))state.hex=`#${first.toUpperCase()}`;}$$(".palette-tab").forEach(t=>{const active=t.dataset.type===state.paletteType;t.classList.toggle("active",active);t.setAttribute("aria-selected",active);});}

  initFromUrl(); setColor(state.hex); renderRecents(); renderFavorites(); updateThemeIcon(); updateGradient(); updateContrast();
  if(window.lucide)lucide.createIcons();
})();
