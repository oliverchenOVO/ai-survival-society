const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let runtime, win, closing=false;
app.requestSingleInstanceLock() || app.quit();
app.on('second-instance',()=>{if(win){win.restore();win.focus();}});
app.whenReady().then(async()=>{
  try {
    const { startServer } = await import(pathToFileURL(path.join(__dirname,'..','server','index.mjs')).href);
    runtime=await startServer({port:0,dataDir:app.getPath('userData')});
    win=new BrowserWindow({width:1540,height:980,minWidth:800,minHeight:700,backgroundColor:'#080f18',title:'AI Survival Society',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
    const origin=`http://127.0.0.1:${runtime.port}`;
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
    win.webContents.session.on('will-download',(_,item)=>{if(!item.getFilename().endsWith('.json'))item.cancel();});
    await win.loadURL(origin);
  } catch(error){dialog.showErrorBox('Could not start Society',error.message);app.quit();}
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',event=>{if(runtime&&!closing){event.preventDefault();closing=true;runtime.close().finally(()=>app.quit());}});
