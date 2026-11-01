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
    const response=await fetch(url.toString(),{signal});
    if(!response.ok)throw Error("Census boundary server returned "+response.status);
    const data=await response.json();
    if(data.error)throw Error(data.error.message||"Census server error");
    if(data.type!=="FeatureCollection"||!Array.isArray(data.features))throw Error("Unexpected official geographic response");
    return {features:data.features,field,source:url.toString(),vintage:missouri?"119th (2024 lines reinstated for 2026)":"120th Congress (2026)"};
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
      const map=L.map(ROOT,{attributionControl:false,scrollWheelZoom:false,zoomControl:true,preferCanvas:false,
        minZoom:2,zoomSnap:0.25,keyboard:true});
      const group=L.featureGroup();
      const layers=new Map();
      let labels=[];
      for(const feature of features){
        const id=featureId(feature,state.code,field),row=byId.get(id);
        const info=districtEvidence(row),paint=color(info.party,info.margin);
        const layer=L.geoJSON(feature,{style:()=>({fillColor:paint.bg,color:"#44545d",weight:1.25,
          fillOpacity:0.95,opacity:1}),interactive:true});
        layer.eachLayer(shape=>{
          shape.bindTooltip(makeInfoNode(id,info),{sticky:true,direction:"top",opacity:0.98,className:"district-map-tip"});
          shape.on("mouseover",()=>{shape.setStyle({weight:3,color:"#142d3b",fillOpacity:1});shape.bringToFront();});
          shape.on("mouseout",()=>layer.resetStyle(shape));
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
      map.fitBounds(group.getBounds(),{padding:[23,23],maxZoom:8});
      const toggleLabels=()=>{
        // Avoid obscuring dozens of narrow congressional seats at small scales.
        const show=map.getZoom()>=5.5||rows.length<=12;
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
        "The map uses Census 120th Congress district geometry for the November 2026 election. Colors show sourced polls or comparable 2024 House results, NOT forecasts.";
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
