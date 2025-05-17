require("dotenv").config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// AWS Configuration
const REGION = 'us-west-2';
const ACCESS_KEY = process.env.ROMS_AWS_ACCESS_KEY;
const SECRET_KEY = process.env.ROMS_AWS_SECRET_ACCESS_KEY;
const BUCKET_NAME = 'ccportedroms';

// Function to capitalize words
function capitalizeWords(str) {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Explore S3 bucket and categorize ROMs
async function exploreS3Roms() {
    console.log(SECRET_KEY, ACCESS_KEY)
    const s3Client = new S3Client({ 
        region: REGION,
        credentials: {
            accessKeyId: ACCESS_KEY,
            secretAccessKey: SECRET_KEY,
        }
    });

    const categories = {};

    try {
        // List objects in the bucket
        const command = new ListObjectsV2Command({ 
            Bucket: BUCKET_NAME,
            Delimiter: '/'  // Use delimiter to get "folders"
        });

        const response = await s3Client.send(command);

        // Process common prefixes (folders)
        if (response.CommonPrefixes) {
            for (const prefix of response.CommonPrefixes) {
                const folderName = prefix.Prefix.replace(/\/$/, '').split('/').pop();
                
                // List objects within each "folder"
                const folderCommand = new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: prefix.Prefix
                });

                const folderResponse = await s3Client.send(folderCommand);

                categories[folderName] = [];

                if (folderResponse.Contents) {
                    folderResponse.Contents
                        .filter(obj => !obj.Key.endsWith('/'))  // Exclude "folder" markers
                        .forEach(obj => {
                            const fileName = obj.Key.split('/').pop();
                            const displayName = capitalizeWords(fileName.split('.')[0]);
                            categories[folderName].push([fileName, displayName]);
                        });
                }
            }
        }

        // Write results to JSON file
        fs.writeFileSync(path.join(__dirname, 'roms.json'), JSON.stringify(categories, null, 2));
        
        console.log('S3 ROM exploration complete. Results saved to s3_roms.json');
        return categories;
    } catch (error) {
        console.error('Error exploring S3 bucket:', error);
        throw error;
    }
}

// Export the function to be called
module.exports = {
    exploreS3Roms
};

// If running directly, execute the exploration
if (require.main === module) {
    exploreS3Roms()
        .then(roms => console.log('Roms explored:', roms))
        .catch(error => console.error('Exploration failed:', error));
}