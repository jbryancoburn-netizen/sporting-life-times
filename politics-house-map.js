/* The Political Life & Times — official 2026 district geometry viewer.
 * District polygons come from U.S. Census TIGERweb (120th Congress).
 * Missouri uses the 119th layer until superseded 2026 geometries are corrected.
 * Geography never supplies an inferred vote margin or forecast.
 */
(function(){
  "use strict";
  const FIPS={
    AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",FL:"12",GA:"13",
    HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",LA:"22",ME:"23",MD:"24",
    MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",
    NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
    SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56"
  };
  const SOURCE="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer";
  const STATUS=document.getElementById("district-map-status");
  const ROOT=document.getElementById("geo-district-map");
  const JUMP=document.getElementById("map-district-jump");
  const setStatus=(message)=>{if(STATUS)STATUS.textContent=message};
  const flattenGeojsonAlaska=geometry=>{
    // The western Aleutians cross the 180th meridian. Keep Alaska geographically contiguous.
    const shift=coord=>{
      if(typeof coord[0]==="number")return [coord[0]>0?coord[0]-360:coord[0],coord[1],...coord.slice(2)];
      return coord.map(shift);
    };
    if(geometry&&geometry.coordinates)geometry.coordinates=shift(geometry.coordinates);
  };
  function featureId(feature,code,field){
    const n=feature?.properties?.[field];
    if(n==null)return null;
    const value=String(n).padStart(2,"0");
    return /^\d{2}$/.test(value)?code+"-"+value:null;
  }
  async function loadFeatures(code,signal){
    const missouri=code==="MO"; // Sept. 23 SCOTUS action: old plan governs November 2026.
    const layer=missouri?4:0,field=missouri?"CD119":"CD120";
    const url=new URL(SOURCE+"/"+layer+"/query");
    url.search=new URLSearchParams({
      where:"STATE='"+FIPS[code]+"'",outFields:"STATE,GEOID,NAME,CENTLAT,CENTLON,"+field,
      returnGeometry:"true",outSR:"4326",geometryPrecision:"5",maxAllowableOffset:"0.0015",
      f:"geojson"
    }).toString();
    // Prefer our published, ID-validated Census copy: no per-visitor Census API dependency.
    // Before the archive workflow finishes (or if a file is missing), use official live API.
    let data=null;
    try{
      const local=await fetch("politics-geometry/"+code+".geojson",{signal,cache:"force-cache"});
      if(local.ok){
        const candidate=await local.json();
        if(candidate.meta?.state===code&&candidate.meta?.layer===layer&&candidate.meta?.field===field)
          data=candidate;
      }
    }catch(error){if(error.name==="AbortError")throw error;}
    if(!data){
      const response=await fetch(url.toString(),{signal});
      if(!response.ok)throw Error("Census boundary server returned "+response.status);
      data=await response.json();
    }
    if(data.error)throw Error(data.error.message||"Census server error");
    if(data.type!=="FeatureCollection"||!Array.isArray(data.features))throw Error("Unexpected official geographic response");
    // The Census may also return ZZ polygons (unassigned water), not voting House seats.
    const districts=data.features.filter(f=>f.properties?.[field]!=="ZZ");
    return {features:districts,field,source:data.meta?.source_url||url.toString(),vintage:missouri?"119th (2024 lines reinstated for 2026)":"120th Congress (2026)"};
  }
  function makeInfoNode(id,info){
    const box=document.createElement("div");
    const strong=document.createElement("strong");strong.textContent=id;
    const detail=document.createElement("div");detail.textContent=info.source+" · "+info.text;
    box.append(strong,detail);return box;
  }
  function buildFail(message){
    setStatus("District geography unavailable. The numbered district links below remain accessible.");
    const error=document.getElementById("map-fallback");
    if(error){error.hidden=false;error.textContent="The official geographic layer could not be verified or loaded ("+message+"). No inaccurate map will be substituted. Use the district directory below.";}
    if(ROOT)ROOT.hidden=true;
  }
  async function drawState({state,rows,districtEvidence,color,urlForDistrict}){
    if(!ROOT||!FIPS[state.code])return;
    if(!window.L){buildFail("map library unavailable");return;}
    setStatus("Loading official Census district boundaries for "+state.name+"…");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const {features,field,source,vintage}=await loadFeatures(state.code,controller.signal);
      const byId=new Map(rows.map(row=>[row.id,row]));
      const seen=new Set();
      for(const feature of features){
        const id=featureId(feature,state.code,field);
        if(!id||!byId.has(id)||seen.has(id)||!feature.geometry)throw Error("District IDs or polygons do not match our 435-seat ledger");
        seen.add(id);
        if(state.code==="AK")flattenGeojsonAlaska(feature.geometry);
      }
      if(seen.size!==rows.length)throw Error("Missing or unexpected districts ("+seen.size+" of "+rows.length+")");
      // The original viewer drew district polygons on an EMPTY background.
      // That obscured the geographic context, especially Michigan's two peninsulas
      // and the closely packed districts around Detroit. Use an ACTUAL street/
      // community basemap beneath authoritative Census boundaries.
      // Standard OSM raster tiles are requested only as a reader pans or zooms.
      // https://operations.osmfoundation.org/policies/tiles/
      const map=L.map(ROOT,{attributionControl:true,scrollWheelZoom:false,zoomControl:true,preferCanvas:false,
        minZoom:2,maxZoom:17,zoomSnap:0.25,keyboard:true});
      const OSM_TILES="https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      const base=L.tileLayer(OSM_TILES,{
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        minZoom:2,maxZoom:17,maxNativeZoom:17,detectRetina:false,
        className:"politics-geographic-basemap",
        crossOrigin:false
      }).addTo(map);
      let basemapErrorCount=0;
      base.on("tileerror",()=>{
        basemapErrorCount++;
        if(basemapErrorCount===3){
          const warning=document.getElementById("map-base-warning");
          if(warning){warning.hidden=false;warning.textContent="Street-map tiles could not be loaded. The congressional district outlines are still authentic U.S. Census geography; the official map link below remains available.";}
        }
      });
      const group=L.featureGroup();
      const layers=new Map();
      const mapEvidence=new Map();
      let mapView="geography";
      let selectedDistrict="";
      // Geography is the default. Political colors are shown only after an explicit
      // reader choice and only where the existing evidence source provides them.
      const districtStyle=id=>{
        const evidence=mapEvidence.get(id);
        const chosen=selectedDistrict===id;
        return {
          fillColor:mapView==="evidence"&&evidence?.eligible?evidence.color:"#c9bda7",
          color:chosen?"#793e32":"#3a352e",
          weight:chosen?3.7:1.8,
          fillOpacity:mapView==="evidence"&&evidence?.eligible?0.48:(chosen?0.33:0.18),
          opacity:1,dashArray:null
        };
      };
      const redraw=()=>layers.forEach((layer,id)=>layer.setStyle(districtStyle(id)));
      let labels=[];
      for(const feature of features){
        const id=featureId(feature,state.code,field),row=byId.get(id);
        const info=districtEvidence(row),paint=color(info.party,info.margin);
        mapEvidence.set(id,{color:paint.bg,eligible:!!(info.party&&info.margin!==null&&info.margin!==undefined&&info.margin!==""&&Number.isFinite(Number(info.margin)))});
        const layer=L.geoJSON(feature,{style:()=>districtStyle(id),interactive:true});
        layer.eachLayer(shape=>{
          shape.bindTooltip(makeInfoNode(id,info),{sticky:true,direction:"top",opacity:0.98,className:"district-map-tip"});
          shape.on("mouseover",()=>{shape.setStyle({weight:3.1,color:"#7b4034",fillOpacity:0.4});shape.bringToFront();});
          shape.on("mouseout",()=>shape.setStyle(districtStyle(id)));
          shape.on("click",()=>{location.href=urlForDistrict(id)});
          shape.on("add",()=>{
            const el=shape.getElement();
            if(!el)return;
            el.setAttribute("role","link");el.setAttribute("tabindex","0");
            el.setAttribute("aria-label",id+": "+info.text+". Open district profile.");
            el.addEventListener("keydown",event=>{
              if(event.key==="Enter"||event.key===" "){event.preventDefault();location.href=urlForDistrict(id)}
            });
          });
        });
        group.addLayer(layer);
        layers.set(id,layer);
        const lat=Number(feature.properties?.CENTLAT),lon=Number(feature.properties?.CENTLON);
        const lonAdjusted=state.code==="AK"&&lon>0?lon-360:lon;
        const pt=Number.isFinite(lat)&&Number.isFinite(lonAdjusted)?L.latLng(lat,lonAdjusted):layer.getBounds().getCenter();
        const badge=document.createElement("span");
        badge.className="house-district-label";badge.textContent=id.slice(3);
        badge.title=id;
        const icon=L.divIcon({html:badge,iconSize:[27,23],iconAnchor:[13,11],className:"house-district-icon"});
        const marker=L.marker(pt,{icon,keyboard:true,title:id+" — open district",zIndexOffset:700});
        marker.on("click",()=>{location.href=urlForDistrict(id)});
        marker.addTo(map);
        labels.push(marker);
      }
      group.addTo(map);
      const viewControls=document.getElementById("map-shading-controls");
      const viewLegend=document.getElementById("map-shading-explanation");
      const describeView=()=>{
        if(viewLegend)viewLegend.textContent=mapView==="geography"?
          "GEOGRAPHY · All districts share neutral newsprint shading. A darker outline marks the selected district. Colors do not indicate political preference.":
          "DATED ELECTION EVIDENCE · Subdued red and blue appear only where the existing district evidence includes a party and numeric margin. Neutral beige indicates unavailable evidence; this is not a 2026 forecast.";
      };
      if(viewControls){
        viewControls.replaceChildren();
        for(const [mode,label] of [["geography","Geographic atlas"],["evidence","Election evidence"]]){
          const button=document.createElement("button");
          button.type="button";button.textContent=label;
          button.className="ledger-map-mode";
          button.setAttribute("aria-pressed",String(mapView===mode));
          button.addEventListener("click",()=>{
            mapView=mode;
            viewControls.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===button)));
            redraw();describeView();
          });
          viewControls.append(button);
        }
        describeView();
      }
      const completeBounds=group.getBounds();
      map.fitBounds(completeBounds,{padding:[32,32],maxZoom:8});
      const michiganSource=document.getElementById("map-official-michigan");
      if(michiganSource)michiganSource.hidden=state.code!=="MI";
      const zoomViews=document.getElementById("map-real-views");
      if(zoomViews){
        zoomViews.hidden=false;
        zoomViews.replaceChildren();
        const views=[{label:"Entire state",action:()=>map.fitBounds(completeBounds,{padding:[32,32],maxZoom:8})}];
        if(state.code==="MI"){
          // Coordinates are geographic viewport centers, not inferred district centroids.
          // Readers can see true Michigan terrain and towns on OSM tiles underneath
          // the exact archived 2026 Census congressional polygons.
          views.push(
            {label:"Detroit metro",action:()=>map.setView([42.45,-83.15],9)},
            {label:"Grand Rapids",action:()=>map.setView([42.97,-85.67],9)},
            {label:"Northern Michigan",action:()=>map.setView([44.77,-85.62],8)},
            {label:"Upper Peninsula",action:()=>map.setView([46.5,-87.3],7)}
          );
        }
        for(const view of views){
          const button=document.createElement("button");button.type="button";
          button.textContent=view.label;button.className="map-real-view";
          button.addEventListener("click",()=>{view.action();setStatus(state.name+": viewing "+view.label.toLowerCase()+" on the OpenStreetMap base with verified Census district boundaries.");});
          zoomViews.append(button);
        }
      }
      const toggleLabels=()=>{
        // Avoid obscuring dozens of narrow congressional seats at small scales.
        // Metro Detroit labels overlap at the Michigan overview scale.
        // Keep polygons clickable at every zoom; show number chips only after zoom.
        const show=state.code==="MI"?map.getZoom()>=8:(map.getZoom()>=5.5||rows.length<=12);
        labels.forEach(marker=>{
          const el=marker.getElement();
          if(el)el.style.display=show?"":"none";
        });
      };
      map.on("zoomend",toggleLabels);toggleLabels();
      const option0=document.createElement("option");option0.value="";option0.textContent="Find a district on the map";
      JUMP.replaceChildren(option0);
      rows.forEach(row=>{
        const option=document.createElement("option");option.value=row.id;
        option.textContent=row.at_large?state.name+" at-large":row.id;JUMP.append(option);
      });
      JUMP.addEventListener("change",()=>{
        const id=JUMP.value,shape=layers.get(id);
        if(!shape)return;
        selectedDistrict=id;redraw();
        map.fitBounds(shape.getBounds(),{padding:[35,35],maxZoom:9});
        setStatus(id+" selected. Click the highlighted district or choose “Open selected district.”");
      });
      const go=document.getElementById("map-open-district");
      if(go){
        go.addEventListener("click",()=>{if(layers.has(JUMP.value))location.href=urlForDistrict(JUMP.value)});
      }
      const link=document.getElementById("map-source-link");
      if(link){link.href=source;link.textContent="U.S. Census Bureau "+vintage+" geography ↗";}
      const mo=document.getElementById("map-vintage-note");
      if(mo)mo.textContent=state.code==="MO"?
        "Missouri: the 119th Congress boundaries are displayed because the newer map was blocked for the 2026 election. Some Census 120th products still show the superseded map.":
        "District outlines: official Census 120th Congress (2026) polygons. Street and city labels: OpenStreetMap contributors. Transparent blue/red shading only reflects dated source evidence, never a 2026 forecast.";
      setStatus(state.name+": "+seen.size+" of "+rows.length+" districts matched to official Census geometry. Click any district to open its profile.");
      // Leaflet must recalculate its dimensions after the state section renders.
      requestAnimationFrame(()=>map.invalidateSize());
    }catch(error){
      console.error("Official district geography:",error);
      buildFail(error.name==="AbortError"?"official source timed out":error.message);
    }finally{clearTimeout(timer);}
  }
  window.PoliticsHouseMap={drawState};
})();
