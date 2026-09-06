use std::process::Command;

/// Open a native folder-selection dialog and return the chosen path, if any.
pub fn select_folder() -> Result<Option<String>, String> {
    // Use native file dialog via system command
    // This is a simple cross-platform approach
    #[cfg(target_os = "windows")]
    {
        // Windows: use PowerShell
        let output = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }"
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if path.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path))
                }
            }
            _ => Ok(None),
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: use osascript
        let script = r#"tell application "System Events"
    activate
    set folderPath to choose folder with prompt "Select Workspace Folder"
    return POSIX path of folderPath
end tell"#;

        let output = Command::new("osascript").arg("-e").arg(script).output();

        match output {
            Ok(out) if out.status.success() => {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if path.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(path))
                }
            }
            _ => Ok(None),
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: prefer a native Tk folder picker when available, then fall back to common desktop helpers.
        let python_dialogs = vec!["python3", "python"];
        let python_script = r#"
import sys
try:
    import tkinter as tk
    from tkinter import filedialog
except Exception:
    sys.exit(1)
root = tk.Tk()
root.withdraw()
try:
    root.attributes('-topmost', True)
except Exception:
    pass
path = filedialog.askdirectory(title='Select Workspace Folder')
print(path or '', end='')
"#;

        for python in python_dialogs {
            if let Ok(output) = Command::new(python).args(["-c", python_script]).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Ok(Some(path));
                    }
                }
            }
        }

        // Fall back to common Linux dialog tools when Python/Tk is unavailable.
        let commands = vec![
            (
                "zenity",
                vec![
                    "--file-selection",
                    "--directory",
                    "--title=Select Workspace Folder",
                ],
            ),
            (
                "kdialog",
                vec![
                    "--getexistingdirectory",
                    ".",
                    "--title",
                    "Select Workspace Folder",
                ],
            ),
            (
                "yad",
                vec!["--file", "--directory", "--title=Select Workspace Folder"],
            ),
        ];

        for (cmd, args) in commands {
            if let Ok(output) = Command::new(cmd).args(args).output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        return Ok(Some(path));
                    }
                }
            }
        }

        Err(
            "No native folder picker was available. Install python3-tk, zenity, kdialog, or yad."
                .to_string(),
        )
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform".to_string())
    }
}
