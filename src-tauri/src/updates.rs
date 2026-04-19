use tauri_plugin_updater::UpdaterExt;

pub async fn auto_update(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let update = app.updater()?.check().await?;

    if let Some(update) = update {
        update
            .download_and_install(
                |chunk_length, content_length| {
                    log::info!(
                        "Downloading update: {} bytes / {:?}",
                        chunk_length,
                        content_length
                    );
                },
                || {
                    log::info!("Update download finished");
                },
            )
            .await?;

        log::info!("Update installed, restarting...");
        app.restart();
    }

    Ok(())
}
