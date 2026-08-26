import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Leasing Imprimantes API')
    .setDescription('API NestJS — parc, stock, relevés, facturation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification')
    .addTag('health', 'Santé API / base')
    .addTag('utilisateurs', 'Comptes utilisateurs')
    .addTag('marques', 'Référentiel marques')
    .addTag('fournisseurs', 'Référentiel fournisseurs')
    .addTag('agents', 'Référentiel agents / techniciens')
    .addTag('services', 'Référentiel services')
    .addTag('tarifs', 'Tarifs leasing')
    .addTag('sequences', 'Préfixes / compteurs ID')
    .addTag('imprimantes', 'Parc imprimantes')
    .addTag('modeles-cartouches', 'Modèles de cartouches')
    .addTag('skus', 'Stock par modèle + couleur')
    .addTag('entrees-stock', 'Entrées stock')
    .addTag('affectations', 'Poses / affectations')
    .addTag('kits-cmyk', 'Pose kit CMYK complet')
    .addTag('releves', 'Relevés compteurs')
    .addTag('vue-mensuelle', 'Vue début / fin / Δ')
    .addTag('controle-releves', 'Contrôle écarts 301')
    .addTag('campagnes', 'Campagne saisie mensuelle')
    .addTag('facturation', 'Facturation période')
    .addTag('maintenance', 'Maintenance imprimantes')
    .addTag('dashboard', 'KPI et alertes')
    .addTag('audit', 'Journal d’audit')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.PORT ?? 3001);
  // 0.0.0.0 = accessible depuis le réseau local (pas seulement localhost)
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`API LAN: http://<votre-ip>:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Swagger on http://localhost:${port}/api/docs`);
}

bootstrap();
