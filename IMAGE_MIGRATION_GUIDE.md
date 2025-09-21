# Image Migration Guide

## Overview
This guide outlines the process to migrate image files from `ccported.github.io` repository to the `ccported/games` repository under the `/assets/images` path.

## Current Situation
- Images are currently stored in `./static/assets/images/game_covers/` in this repository
- Target location: `ccported/games/assets/images/`
- Migration script: `migrate_images.js` has been created to facilitate this process

## Migration Steps

### 1. Prepare the Source Directory
The images to be migrated are located in:
```
./static/assets/images/game_covers/
```

Currently contains:
- game_cover_1.jpg
- game_cover_2.png  
- game_cover_3.gif

### 2. Clone the Target Repository
```bash
# Clone the games repository as a sibling to this repository
cd ..
git clone https://github.com/ccported/games.git
cd ccported.github.io
```

### 3. Run the Migration Script
```bash
# First, run a dry run to see what will happen
node migrate_images.js --dry-run

# If everything looks good, run the actual migration
node migrate_images.js
```

### 4. Commit Changes to Games Repository
```bash
cd ../games
git add assets/images/
git commit -m "Add migrated game cover images from ccported.github.io"
git push origin main
```

### 5. Update References in This Repository
The migration script will automatically update references in:
- `server/reformat_images.js`
- `server/reformat_image.js`
- `static/big_game_script.js`

Old path format: `../static/assets/images/game_covers/filename.jpg`
New path format: `https://ccported.github.io/games/assets/images/filename.jpg`

### 6. Clean Up (Optional)
After confirming the migration is successful, you can remove the original files:
```bash
rm -rf ./static/assets/images/game_covers/
```

## Script Features

The `migrate_images.js` script includes:
- ✅ Automatic detection of image files (jpg, jpeg, png, gif, webp, svg)
- ✅ Dry run mode for testing
- ✅ Automatic directory creation in target repository
- ✅ Reference updating in source files
- ✅ Progress reporting
- ✅ Error handling

## Verification

After migration, verify:
1. Images are accessible at new URLs
2. Any applications referencing these images still work
3. File sizes and integrity are maintained
4. No broken links remain in the codebase

## Rollback Plan

If issues arise:
1. Revert changes to source files in this repository
2. Copy images back to original location if needed
3. Remove images from games repository

## Notes

- The script assumes the games repository is cloned as a sibling directory
- All image references will be updated to use absolute URLs pointing to the games repository
- The migration preserves file names and extensions
- Original files can be safely removed after successful migration and verification