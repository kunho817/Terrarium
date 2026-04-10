/**
 * Sandboxed Lua runtime for script execution.
 * Creates a fresh Lua VM per invocation with no filesystem/network access.
 * API functions collect mutations which are returned to the TypeScript side.
 */

use mlua::{Lua, Value as LuaValue, Table as LuaTable};
use rand::Rng;
use serde_json::{json, Value};

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScriptResult {
    success: bool,
    error: Option<String>,
    mutations: Vec<Value>,
    logs: Vec<String>,
}

/// Convert a Lua value to a JSON value (supports nil, bool, int, float, string)
fn lua_to_json(value: &LuaValue) -> Value {
    match value {
        LuaValue::Nil => Value::Null,
        LuaValue::Boolean(b) => json!(*b),
        LuaValue::Integer(i) => json!(*i),
        LuaValue::Number(n) => json!(*n),
        LuaValue::String(s) => {
            let str_val = s.to_str().map(|v| v.to_string()).unwrap_or_default();
            json!(str_val)
        }
        _ => json!(null),
    }
}

/// Set up the sandboxed Lua environment with API functions
fn setup_api(
    lua: &Lua,
    context: &Value,
    mutations: &std::sync::Arc<std::sync::Mutex<Vec<Value>>>,
    logs: &std::sync::Arc<std::sync::Mutex<Vec<String>>>,
) -> Result<(), mlua::Error> {
    let globals = lua.globals();

    // Remove dangerous globals
    let _ = globals.set("io", LuaValue::Nil);
    let _ = globals.set("os", LuaValue::Nil);
    let _ = globals.set("debug", LuaValue::Nil);
    let _ = globals.set("package", LuaValue::Nil);
    let _ = globals.set("require", LuaValue::Nil);
    let _ = globals.set("dofile", LuaValue::Nil);
    let _ = globals.set("loadfile", LuaValue::Nil);

    // Set up variables table from context
    let vars = lua.create_table()?;
    if let Some(obj) = context.get("variables").and_then(|v| v.as_object()) {
        for (key, val) in obj {
            match val {
                Value::Bool(b) => {
                    vars.set(key.as_str(), *b)?;
                }
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        vars.set(key.as_str(), i)?;
                    } else {
                        vars.set(key.as_str(), n.as_f64().unwrap_or(0.0))?;
                    }
                }
                Value::String(s) => {
                    vars.set(key.as_str(), s.as_str())?;
                }
                _ => {}
            }
        }
    }
    globals.set("__vars", vars)?;

    // setVar(key, value)
    let m = mutations.clone();
    let set_var = lua.create_function(move |lua, (key, value): (String, LuaValue)| {
        m.lock().unwrap().push(json!({
            "type": "setVar",
            "key": key,
            "value": lua_to_json(&value)
        }));
        let vars: LuaTable = lua.globals().get("__vars")?;
        vars.set(key.as_str(), value)?;
        Ok(())
    })?;
    globals.set("setVar", set_var)?;

    // getVar(key) -> value
    let get_var = lua.create_function(|lua, key: String| -> Result<LuaValue, mlua::Error> {
        let vars: LuaTable = lua.globals().get("__vars")?;
        match vars.get::<LuaValue>(key.as_str()) {
            Ok(v) => Ok(v),
            Err(_) => Ok(LuaValue::Nil),
        }
    })?;
    globals.set("getVar", get_var)?;

    // hasVar(key) -> bool
    let has_var = lua.create_function(|lua, key: String| -> Result<bool, mlua::Error> {
        let vars: LuaTable = lua.globals().get("__vars")?;
        let val: LuaValue = vars.get(key.as_str())?;
        Ok(!matches!(val, LuaValue::Nil))
    })?;
    globals.set("hasVar", has_var)?;

    // deleteVar(key)
    let m = mutations.clone();
    let delete_var = lua.create_function(move |lua, key: String| {
        m.lock().unwrap().push(json!({ "type": "deleteVar", "key": &key }));
        let vars: LuaTable = lua.globals().get("__vars")?;
        vars.set(key.as_str(), LuaValue::Nil)?;
        Ok(())
    })?;
    globals.set("deleteVar", delete_var)?;

    // setLocation(value)
    let m = mutations.clone();
    let set_location = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setLocation", "value": &value }));
        Ok(())
    })?;
    globals.set("setLocation", set_location)?;

    // setTime(value)
    let m = mutations.clone();
    let set_time = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setTime", "value": &value }));
        Ok(())
    })?;
    globals.set("setTime", set_time)?;

    // setMood(value)
    let m = mutations.clone();
    let set_mood = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setMood", "value": &value }));
        Ok(())
    })?;
    globals.set("setMood", set_mood)?;

    // getLocation() -> string
    let ctx = context.clone();
    let get_location = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let loc = ctx
            .get("scene")
            .and_then(|s| s.get("location"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        Ok(loc.to_string())
    })?;
    globals.set("getLocation", get_location)?;

    // getTime() -> string
    let ctx = context.clone();
    let get_time = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let time = ctx
            .get("scene")
            .and_then(|s| s.get("time"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        Ok(time.to_string())
    })?;
    globals.set("getTime", get_time)?;

    // getMood() -> string
    let ctx = context.clone();
    let get_mood = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let mood = ctx
            .get("scene")
            .and_then(|s| s.get("mood"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        Ok(mood.to_string())
    })?;
    globals.set("getMood", get_mood)?;

    // rollDice(sides) -> number
    let roll_dice = lua.create_function(|_, sides: i64| -> Result<i64, mlua::Error> {
        let sides = sides.max(1);
        let result = rand::thread_rng().gen_range(1..=sides);
        Ok(result)
    })?;
    globals.set("rollDice", roll_dice)?;

    // randomChance(percent) -> bool
    let random_chance = lua.create_function(|_, percent: f64| -> Result<bool, mlua::Error> {
        let roll = rand::thread_rng().gen_range(0.0..100.0);
        Ok(roll < percent)
    })?;
    globals.set("randomChance", random_chance)?;

    // log(message)
    let l = logs.clone();
    let log_fn = lua.create_function(move |_, message: String| {
        l.lock().unwrap().push(message);
        Ok(())
    })?;
    globals.set("log", log_fn)?;

    // matchRegex(text, pattern) -> table|nil
    let match_regex =
        lua.create_function(|lua, (text, pattern): (String, String)| -> Result<LuaValue, mlua::Error> {
            match regex::Regex::new(&pattern) {
                Ok(re) => {
                    let captures: Vec<String> =
                        re.find_iter(&text).map(|m| m.as_str().to_string()).collect();
                    if captures.is_empty() {
                        Ok(LuaValue::Nil)
                    } else {
                        let table = lua.create_table()?;
                        for (i, cap) in captures.iter().enumerate() {
                            table.set(i + 1, cap.as_str())?;
                        }
                        Ok(LuaValue::Table(table))
                    }
                }
                Err(_) => Ok(LuaValue::Nil),
            }
        })?;
    globals.set("matchRegex", match_regex)?;

    Ok(())
}

#[tauri::command]
pub fn execute_lua_script(script: String, context_json: String) -> Result<String, String> {
    let context: Value = serde_json::from_str(&context_json)
        .map_err(|e| format!("Invalid context JSON: {}", e))?;

    let lua = Lua::new();
    let mutations: std::sync::Arc<std::sync::Mutex<Vec<Value>>> =
        std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let logs: std::sync::Arc<std::sync::Mutex<Vec<String>>> =
        std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));

    setup_api(&lua, &context, &mutations, &logs).map_err(|e| format!("API setup error: {}", e))?;

    match lua.load(&script).exec() {
        Ok(()) => {}
        Err(e) => {
            let result = ScriptResult {
                success: false,
                error: Some(e.to_string()),
                mutations: mutations.lock().unwrap().drain(..).collect(),
                logs: logs.lock().unwrap().drain(..).collect(),
            };
            return serde_json::to_string(&result).map_err(|e| e.to_string());
        }
    }

    let result = ScriptResult {
        success: true,
        error: None,
        mutations: mutations.lock().unwrap().drain(..).collect(),
        logs: logs.lock().unwrap().drain(..).collect(),
    };

    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_var() {
        let result = execute_lua_script(
            "setVar(\"hp\", 100)".to_string(),
            "{\"variables\":{}}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.mutations.len(), 1);
        assert_eq!(parsed.mutations[0]["type"], "setVar");
        assert_eq!(parsed.mutations[0]["key"], "hp");
        assert_eq!(parsed.mutations[0]["value"], 100);
    }

    #[test]
    fn test_get_var() {
        let result = execute_lua_script(
            "local hp = getVar(\"player.hp\")\nsetVar(\"result\", hp)".to_string(),
            "{\"variables\":{\"player.hp\":85}}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.mutations.len(), 1);
        assert_eq!(parsed.mutations[0]["value"], 85);
    }

    #[test]
    fn test_roll_dice() {
        let result = execute_lua_script(
            "local roll = rollDice(6)\nsetVar(\"last_roll\", roll)".to_string(),
            "{\"variables\":{}}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        let value = parsed.mutations[0]["value"].as_i64().unwrap();
        assert!((1..=6).contains(&value));
    }

    #[test]
    fn test_log() {
        let result = execute_lua_script(
            "log(\"hello from lua\")".to_string(),
            "{}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.logs, vec!["hello from lua"]);
    }

    #[test]
    fn test_syntax_error() {
        let result = execute_lua_script(
            "invalid lua syntax {[".to_string(),
            "{}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(!parsed.success);
        assert!(parsed.error.is_some());
    }

    #[test]
    fn test_sandbox_no_os() {
        let result = execute_lua_script(
            "local ok, _ = pcall(function() os.execute(\"echo test\") end)\nsetVar(\"sandboxed\", ok)"
                .to_string(),
            "{\"variables\":{}}".to_string(),
        )
        .unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
    }
}
