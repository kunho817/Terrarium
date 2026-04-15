# Suggested Commands for Terrarium

## Development Commands
```powershell
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run check
```

## Tauri Commands
```powershell
# Run Tauri development (desktop app)
npm run tauri dev

# Build Tauri app
npm run tauri build
```

## Windows System Commands
```powershell
# List directory contents
dir
# or
ls

# Change directory
cd <path>

# Search in files
findstr /s /i "pattern" *.ts

# Git commands
git status
git log --oneline -5
git add <file>
git commit -m "message"
git push
git checkout <branch>

# File operations
copy <source> <dest>
move <source> <dest>
del <file>
```

## Utility Commands
```powershell
# Find files by pattern
Get-ChildItem -Recurse -Filter "*.ts"

# Search file contents
Select-String -Path "src\*.ts" -Pattern "searchterm"

# Package management
npm install <package>
npm update
npm audit fix
```
