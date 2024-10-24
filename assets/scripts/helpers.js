if(typeof supabase === "undefined"){
    installSupascript().then(()=>{
        log("Supabase script loaded");
    });
}else{
    window.ccSupaClient = createClient();
}

function installSupascript(){
    log("Installing Supabase script");
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@supabase/supabase-js@2";
    document.head.appendChild(script);
    const loadPromise = new Promise((r,rr)=>{
        script.onload = ()=>{
            window.ccSupaClient = createClient();
            r();
        }
    });

    return loadPromise;
}
function createClient(){
    const SUPABASE_URL = 'https://dahljrdecyiwfjgklnvz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaGxqcmRlY3lpd2ZqZ2tsbnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgyNjE3NzMsImV4cCI6MjA0MzgzNzc3M30.8-YlXqSXsYoPTaDlHMpTdqLxfvm89-8zk2HG2MCABRI';
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
function shortcut(keys, cb) {
    log(`Creating shortcut for keys ${keys}, calling ${cb.name}`);
    var keyMap = {};
    for (const key of keys) {
        keyMap[key] = false;
    }
    document.addEventListener("keydown", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = true;
        }
        if (check()) {
            cb();
        }
    });
    document.addEventListener("keyup", (e) => {
        if (keyMap[e.which] !== undefined) {
            keyMap[e.which] = false;
        }
    });
    function check() {
        var allPressed = true;
        for (const key of keys) {
            if (!keyMap[key]) {
                allPressed = false;
            }
        }
        return allPressed;
    }
}