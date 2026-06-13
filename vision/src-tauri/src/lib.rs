use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
async fn generate_thumb(app: tauri::AppHandle, path: String) -> Result<String, String> {
    // Les miniatures sont écrites dans le dossier cache de l'app, et NON à côté
    // de l'image source : sur macOS, l'app n'a pas le droit de relire un fichier
    // qu'elle a créé dans un dossier utilisateur protégé (TCC), ce qui faisait
    // échouer leur upload R2. Son propre cache est toujours accessible.
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        use std::hash::{Hash, Hasher};
        use std::path::Path;
        let src = Path::new(&path);
        let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("thumb");

        // Refuse les fichiers trop lourds pour éviter un OOM
        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        if file_size > 200 * 1024 * 1024 {
            return Err("file too large (>200 MB)".to_string());
        }

        let thumb_dir = cache_dir.join("thumbs");
        std::fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;

        // Nom unique dérivé du chemin source complet (évite les collisions de stem)
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        path.hash(&mut hasher);
        let thumb_path = thumb_dir.join(format!("{:x}-{}.jpg", hasher.finish(), stem));

        if thumb_path.exists() {
            return Ok(thumb_path.to_string_lossy().to_string());
        }
        let img = image::open(&path).map_err(|e| e.to_string())?;
        let thumb = img.thumbnail(500, 500);
        thumb
            .save_with_format(&thumb_path, image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
        Ok(thumb_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_core_tables",
            sql: "
            CREATE TABLE IF NOT EXISTS projects (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                status     TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS media (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                kind       TEXT NOT NULL,
                path       TEXT NOT NULL,
                starred    INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS comments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                media_id   INTEGER REFERENCES media(id) ON DELETE CASCADE,
                author     TEXT NOT NULL,
                body       TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS validations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                decision   TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_media_title",
            sql: "ALTER TABLE media ADD COLUMN title TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_stages",
            sql: "
            CREATE TABLE IF NOT EXISTS stages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                label      TEXT NOT NULL,
                position   INTEGER NOT NULL,
                status     TEXT NOT NULL DEFAULT 'todo',
                reached_at TEXT
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_invites",
            sql: "
            CREATE TABLE IF NOT EXISTS invites (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                code        TEXT NOT NULL UNIQUE,
                email       TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                accepted_at TEXT
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_project_description",
            sql: "ALTER TABLE projects ADD COLUMN description TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_media_before_path",
            sql: "ALTER TABLE media ADD COLUMN before_path TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_annotations_approval_album",
            sql: "
                ALTER TABLE comments ADD COLUMN x REAL;
                ALTER TABLE comments ADD COLUMN y REAL;
                ALTER TABLE media ADD COLUMN approval TEXT;
                ALTER TABLE media ADD COLUMN album TEXT;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_comment_resolved",
            sql: "ALTER TABLE comments ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_media_thumb_path",
            sql: "ALTER TABLE media ADD COLUMN thumb_path TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_project_cover_path",
            sql: "ALTER TABLE projects ADD COLUMN cover_path TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_media_in_delivery",
            sql: "ALTER TABLE media ADD COLUMN in_delivery INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_media_position",
            sql: "ALTER TABLE media ADD COLUMN position INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:vision.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![generate_thumb])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
