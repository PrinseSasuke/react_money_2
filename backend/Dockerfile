FROM node:20-alpine

WORKDIR /app

# DejaVu Sans поддерживает кириллицу — нужен pdfkit для отчётов на русском
# (встроенный Helvetica умеет только латиницу)
RUN apk add --no-cache ttf-dejavu

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
