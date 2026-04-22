use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    if std::env::var("CARGO_FEATURE_SWISSEPH").is_ok() {
        build_swisseph();
    }
    tauri_build::build();
}

fn build_swisseph() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR missing"));
    let source_dir = manifest_dir.join("vendor").join("swisseph-2.10.03");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR missing"));
    let cc = env::var("CC").unwrap_or_else(|_| "cc".to_string());
    let ar = env::var("AR").unwrap_or_else(|_| "ar".to_string());

    let sources = [
        "swedate.c",
        "swehouse.c",
        "swejpl.c",
        "swemmoon.c",
        "swemplan.c",
        "sweph.c",
        "swephlib.c",
        "swecl.c",
        "swehel.c",
    ];

    for source in &sources {
        println!("cargo:rerun-if-changed={}", source_dir.join(source).display());
    }
    println!("cargo:rerun-if-changed={}", manifest_dir.join("resources").join("swisseph").display());

    let mut objects = Vec::with_capacity(sources.len());
    for source in &sources {
        let src_path = source_dir.join(source);
        let obj_path = out_dir.join(format!("{}.o", source.trim_end_matches(".c")));
        run(Command::new(&cc)
            .arg("-c")
            .arg("-O2")
            .arg("-fPIC")
            .arg("-I")
            .arg(&source_dir)
            .arg(&src_path)
            .arg("-o")
            .arg(&obj_path));
        objects.push(obj_path);
    }

    let lib_path = out_dir.join("libswe.a");
    if lib_path.exists() {
        std::fs::remove_file(&lib_path).expect("failed to remove old libswe.a");
    }
    let mut ar_cmd = Command::new(&ar);
    ar_cmd.arg("crus").arg(&lib_path);
    for object in &objects {
        ar_cmd.arg(object);
    }
    run(&mut ar_cmd);

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=swe");
    println!("cargo:rustc-link-lib=m");
    #[cfg(target_os = "linux")]
    println!("cargo:rustc-link-lib=dl");
}

fn run(command: &mut Command) {
    let status = command.status().unwrap_or_else(|err| panic!("failed to run {:?}: {err}", command));
    assert!(status.success(), "command {:?} failed with status {status}", command);
}
