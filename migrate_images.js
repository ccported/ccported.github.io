#!/usr/bin/env node

/**
 * Script to migrate image files from this repository to ccported/games/assets/images
 * 
 * This script identifies image files that should be moved to the games repository
 * and provides the mechanism to copy them to the target location.
 * 
 * Usage: node migrate_images.js [--dry-run] [--source=<directory>]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const DEFAULT_SOURCE_DIR = './static/assets/images/game_covers';
const TARGET_REPO_PATH = '../games'; // Assumes games repo is cloned as sibling
const TARGET_ASSETS_PATH = 'assets/images';

async function findImageFiles(directory) {
    try {
        const files = await fs.readdir(directory);
        const imageFiles = [];
        
        for (const file of files) {
            const filePath = path.join(directory, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isFile()) {
                const ext = path.extname(file).toLowerCase();
                if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
                    imageFiles.push({
                        name: file,
                        path: filePath,
                        size: stat.size
                    });
                }
            }
        }
        
        return imageFiles;
    } catch (error) {
        console.error(`Error reading directory ${directory}:`, error.message);
        return [];
    }
}

async function copyImageToGamesRepo(imageFile, dryRun = false) {
    const targetDir = path.join(TARGET_REPO_PATH, TARGET_ASSETS_PATH);
    const targetPath = path.join(targetDir, imageFile.name);
    
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Copying ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)}KB)`);
    console.log(`  Source: ${imageFile.path}`);
    console.log(`  Target: ${targetPath}`);
    
    if (!dryRun) {
        try {
            // Ensure target directory exists
            await fs.mkdir(targetDir, { recursive: true });
            
            // Copy the file
            await fs.copyFile(imageFile.path, targetPath);
            
            console.log(`  ✓ Successfully copied ${imageFile.name}`);
            return true;
        } catch (error) {
            console.error(`  ✗ Failed to copy ${imageFile.name}:`, error.message);
            return false;
        }
    }
    
    return true;
}

async function updateReferences(imageFiles, dryRun = false) {
    // Find files that might reference the moved images
    const referencingFiles = [
        './server/reformat_images.js',
        './server/reformat_image.js',
        './static/big_game_script.js'
    ];
    
    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Checking for image references to update...`);
    
    for (const filePath of referencingFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            let hasChanges = false;
            let updatedContent = content;
            
            // Check for references to the old path
            for (const imageFile of imageFiles) {
                const oldPath = `../static/assets/images/game_covers/${imageFile.name}`;
                const newPath = `https://ccported.github.io/games/assets/images/${imageFile.name}`;
                
                if (content.includes(oldPath)) {
                    console.log(`  Found reference to ${imageFile.name} in ${filePath}`);
                    updatedContent = updatedContent.replace(new RegExp(oldPath, 'g'), newPath);
                    hasChanges = true;
                }
            }
            
            if (hasChanges && !dryRun) {
                await fs.writeFile(filePath, updatedContent);
                console.log(`  ✓ Updated references in ${filePath}`);
            } else if (hasChanges) {
                console.log(`  [DRY RUN] Would update references in ${filePath}`);
            }
        } catch (error) {
            // File might not exist, skip silently
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const sourceArg = args.find(arg => arg.startsWith('--source='));
    const sourceDir = sourceArg ? sourceArg.split('=')[1] : DEFAULT_SOURCE_DIR;
    
    console.log('CCPorted Image Migration Tool');
    console.log('============================');
    console.log(`Source directory: ${sourceDir}`);
    console.log(`Target: ccported/games/${TARGET_ASSETS_PATH}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ACTUAL MIGRATION'}`);
    console.log('');
    
    // Find all image files in the source directory
    const imageFiles = await findImageFiles(sourceDir);
    
    if (imageFiles.length === 0) {
        console.log(`No image files found in ${sourceDir}`);
        console.log('Note: Create some sample images in the game_covers directory if needed.');
        return;
    }
    
    console.log(`Found ${imageFiles.length} image file(s):`);
    imageFiles.forEach(file => {
        console.log(`  - ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    });
    console.log('');
    
    // Check if target repository exists
    try {
        await fs.access(TARGET_REPO_PATH);
    } catch (error) {
        console.error(`Target repository not found at ${TARGET_REPO_PATH}`);
        console.error('Please clone the ccported/games repository as a sibling directory.');
        return;
    }
    
    // Copy images to target repository
    let successCount = 0;
    for (const imageFile of imageFiles) {
        if (await copyImageToGamesRepo(imageFile, dryRun)) {
            successCount++;
        }
    }
    
    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Migration Summary:`);
    console.log(`  Images processed: ${imageFiles.length}`);
    console.log(`  Successful copies: ${successCount}`);
    
    // Update any references in the codebase
    await updateReferences(imageFiles, dryRun);
    
    if (!dryRun && successCount > 0) {
        console.log('\nNext steps:');
        console.log('1. Navigate to the games repository');
        console.log('2. Add and commit the new images:');
        console.log('   git add assets/images/');
        console.log('   git commit -m "Add migrated images from ccported.github.io"');
        console.log('3. Push the changes to the games repository');
        console.log('4. Update any remaining references in this repository');
    }
}

// Run main function if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}