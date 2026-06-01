import os
import shutil
import subprocess
import sys

def main():
    print("[RoboWallet Build & Packaging Automation Script]")
    print("================================================")

    # 1. Paths configuration
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    core_dir = os.path.join(root_dir, "core")
    arduino_src_dir = os.path.join(root_dir, "bindings", "arduino", "src")
    
    target_lib_name = "librobowallet_core.a"
    compiled_lib_path = os.path.join(
        core_dir, 
        "target", 
        "riscv32imc-unknown-none-elf", 
        "release", 
        target_lib_name
    )
    destination_lib_path = os.path.join(arduino_src_dir, target_lib_name)

    print(f"Workspace Root: {root_dir}")
    print(f"Core Rust Directory: {core_dir}")
    print(f"Arduino Destination: {arduino_src_dir}\n")

    # 2. Compile Rust Core
    print("Compiling Rust Core for RISC-V Xtensa/C3 target...")
    try:
        # We specify the active stable msvc toolchain explicitly
        result = subprocess.run(
            ["rustup", "run", "stable-x86_64-pc-windows-msvc", "cargo", "build", "--release", "--target", "riscv32imc-unknown-none-elf"],
            cwd=core_dir,
            check=True,
            capture_output=True,
            text=True
        )
        print("Success: Core built successfully!")
    except subprocess.CalledProcessError as e:
        print("Error: Rust compilation failed!")
        print(e.stderr)
        sys.exit(1)

    # 3. Verify staticlib archive exists
    if not os.path.exists(compiled_lib_path):
        print(f"Error: Compiled library not found at: {compiled_lib_path}")
        sys.exit(1)

    # 4. Copy staticlib to Arduino folder
    print(f"Copying {target_lib_name} to Arduino library bindings...")
    try:
        os.makedirs(arduino_src_dir, exist_ok=True)
        shutil.copy2(compiled_lib_path, destination_lib_path)
        lib_size_kb = os.path.getsize(destination_lib_path) / 1024
        print(f"Success: Copied successfully! Size: {lib_size_kb:.2f} KB")
    except Exception as e:
        print(f"Error copying library: {e}")
        sys.exit(1)

    print("\nBuild automation completed successfully!")
    print("You can now open your Arduino IDE and use the RoboWallet library examples!")

if __name__ == "__main__":
    main()
