/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

interface SeedUser {
  publicId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  identityVerification?: string;
  availability?: string;
}

const USERS: SeedUser[] = [
  {
    publicId: 'seed-patient-0001',
    name: 'Sample Patient',
    email: 'patient@example.com',
    phone: '+15550000001',
    password: 'Patient#2024',
    role: 'PATIENT',
  },
  {
    publicId: 'seed-driver-0001',
    name: 'Sample Driver',
    email: 'driver@example.com',
    phone: '+15550000002',
    password: 'Driver#2024',
    role: 'DRIVER',
    identityVerification: 'VERIFIED',
    availability: 'AVAILABLE',
  },
  {
    publicId: 'seed-dispatcher-0001',
    name: 'Sample Dispatcher',
    email: 'dispatcher@example.com',
    phone: '+15550000003',
    password: 'Dispatch#2024',
    role: 'DISPATCHER',
  },
  {
    publicId: 'seed-admin-0001',
    name: 'Sample Admin',
    email: 'admin@example.com',
    phone: '+15550000004',
    password: 'Admin#2024',
    role: 'ADMIN',
  },
];

async function main(): Promise<void> {
  const driverUserPublicId = 'seed-driver-0001';

  for (const seed of USERS) {
    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { name: seed.name, phone: seed.phone, role: seed.role, passwordHash },
      create: {
        publicId: seed.publicId,
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        passwordHash,
        role: seed.role,
        status: 'ACTIVE',
      },
    });

    if (seed.role === 'DRIVER') {
      await prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: {
          availability: seed.availability ?? 'OFF_DUTY',
          identityVerification: seed.identityVerification ?? 'UNVERIFIED',
          ...(seed.identityVerification === 'VERIFIED' ? { verifiedAt: new Date() } : {}),
        },
        create: {
          userId: user.id,
          availability: seed.availability ?? 'OFF_DUTY',
          licenseVerification: seed.identityVerification === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
          identityVerification: seed.identityVerification ?? 'UNVERIFIED',
          ...(seed.identityVerification === 'VERIFIED' ? { verifiedAt: new Date() } : {}),
        },
      });
    }
  }

  const driver = await prisma.user.findUnique({ where: { email: 'driver@example.com' } });
  if (!driver) {
    throw new Error('Seed driver user missing');
  }

  const ambulances = [
    {
      publicId: 'seed-ambulance-bls-001',
      registrationNumber: 'ABS-BLS-001',
      type: 'BLS',
      serviceArea: 'Central District',
    },
    {
      publicId: 'seed-ambulance-als-002',
      registrationNumber: 'ABS-ALS-002',
      type: 'ALS',
      serviceArea: 'Central District',
    },
  ];

  for (const ambulance of ambulances) {
    await prisma.ambulance.upsert({
      where: { registrationNumber: ambulance.registrationNumber },
      update: { driverId: driver.id, status: 'AVAILABLE', serviceArea: ambulance.serviceArea },
      create: {
        publicId: ambulance.publicId,
        registrationNumber: ambulance.registrationNumber,
        type: ambulance.type,
        capabilities: JSON.stringify([]),
        serviceArea: ambulance.serviceArea,
        status: 'AVAILABLE',
        driverId: driver.id,
      },
    });
  }

  console.log('Seed complete: 4 users, 2 ambulances.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
