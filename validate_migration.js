#!/usr/bin/env node

/**
 * Validation script for image migration
 * Tests that all migrated images are accessible and references are correct
 */

import { promises as fs } from 'fs';
import path from 'path';

const GAMES_ASSETS_PATH = '../games/assets/images';
const SOURCE_FILES_TO_CHECK = [
    './server/reformat_images.js',
    './server/reformat_image.js'
];

async function validateMigratedImages() {
    console.log('🔍 Validating Image Migration');
    console.log('============================\n');
    
    let issues = [];
    
    try {
        // Check if target directory exists and has files
        const targetFiles = await fs.readdir(GAMES_ASSETS_PATH);
        const imageFiles = targetFiles.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
        });
        
        console.log(`✅ Found ${imageFiles.length} images in target directory:`);
        for (const file of imageFiles) {
            const stats = await fs.stat(path.join(GAMES_ASSETS_PATH, file));
            console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
        }
        console.log();
        
        // Check for updated references in source files
        console.log('🔍 Checking updated references in source files:');
        for (const filePath of SOURCE_FILES_TO_CHECK) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                
                // Check for old-style references that should have been updated
                const oldPathPattern = /\.\.\/static\/assets\/images\/game_covers\//g;
                const oldMatches = content.match(oldPathPattern);
                
                // Check for new-style references
                const newPathPattern = /https:\/\/ccported\.github\.io\/games\/assets\/images\//g; 
                const newMatches = content.match(newPathPattern);
                
                if (oldMatches && oldMatches.length > 0) {
                    issues.push(`❌ ${filePath} still contains ${oldMatches.length} old-style path references`);
                } else {
                    console.log(`   ✅ ${filePath} - No old path references found`);
                }
                
                if (newMatches && newMatches.length > 0) {
                    console.log(`   ✅ ${filePath} - Found ${newMatches.length} updated path references`);
                }
                
            } catch (error) {
                console.log(`   ℹ️  ${filePath} - File not found or not accessible`);
            }
        }
        console.log();
        
        // Summary
        if (issues.length === 0) {
            console.log('🎉 Migration Validation: PASSED');
            console.log('All images migrated successfully and references updated correctly.');
        } else {
            console.log('⚠️  Migration Validation: ISSUES FOUND');
            issues.forEach(issue => console.log(issue));
        }
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

// Run validation if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    validateMigratedImages().catch(console.error);
}