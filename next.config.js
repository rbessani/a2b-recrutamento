/** @type {import('next').NextConfig} */
module.exports={experimental:{serverComponentsExternalPackages:['ffmpeg-static'],outputFileTracingIncludes:{'/api/candidatos/audio-ia':['./node_modules/ffmpeg-static/ffmpeg']}}};
