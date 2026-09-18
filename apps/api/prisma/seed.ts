/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seeds synthetic demo data only (never production data).
 *
 * Public identifiers are UUIDs because the API validates them as such (for
 * example `assignAmbulanceSchema.ambulanceId`), and seeded vehicles carry base
 * coordinates so dispatch can rank them by distance. Ambulances are staffed:
 * a vehicle without a verified crew can never be dispatched.
 */
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

interface SeedAmbulance {
  publicId: string;
  registrationNumber: string;
  type: string;
  serviceArea: string;
  capabilities: string[];
  baseLatitude: number;
  baseLongitude: number;
  /** Email of the crew member attached to this vehicle, when staffed. */
  crewEmail?: string;
}

const USERS: SeedUser[] = [
  {
    publicId: '11111111-1111-4111-8111-111111111111',
    name: 'Sample Patient',
    email: 'patient@example.com',
    phone: '+15550000001',
    password: 'Patient#2024',
    role: 'PATIENT',
  },
  {
    publicId: '22222222-2222-4222-8222-222222222222',
    name: 'Sample Driver',
    email: 'driver@example.com',
    phone: '+15550000002',
    password: 'Driver#2024',
    role: 'DRIVER',
    identityVerification: 'VERIFIED',
    availability: 'AVAILABLE',
  },
  {
    publicId: '33333333-3333-4333-8333-333333333333',
    name: 'Second Driver',
    email: 'driver2@example.com',
    phone: '+15550000005',
    password: 'Driver#2024',
    role: 'DRIVER',
    identityVerification: 'VERIFIED',
    availability: 'AVAILABLE',
  },
  {
    publicId: '44444444-4444-4444-8444-444444444444',
    name: 'Sample Dispatcher',
    email: 'dispatcher@example.com',
    phone: '+15550000003',
    password: 'Dispatch#2024',
    role: 'DISPATCHER',
  },
  {
    publicId: '55555555-5555-4555-8555-555555555555',
    name: 'Sample Admin',
    email: 'admin@example.com',
    phone: '+15550000004',
    password: 'Admin#2024',
    role: 'ADMIN',
  },
];

/** Rough city-centre coordinates (synthetic demo area). */
const AMBULANCES: SeedAmbulance[] = [
  {
    publicId: '66666666-6666-4666-8666-666666666666',
    registrationNumber: 'RESQ-BLS-001',
    type: 'BLS',
    serviceArea: 'Central District',
    capabilities: ['oxygen', 'stretcher'],
    baseLatitude: 12.9716,
    baseLongitude: 77.5946,
    crewEmail: 'driver@example.com',
  },
  {
    publicId: '77777777-7777-4777-8777-777777777777',
    registrationNumber: 'RESQ-ALS-002',
    type: 'ALS',
    serviceArea: 'Central District',
    capabilities: ['oxygen', 'defibrillator', 'cardiac monitor'],
    baseLatitude: 12.9611,
    baseLongitude: 77.6387,
    crewEmail: 'driver2@example.com',
  },
  {
    // Staffed pool is intentionally smaller than the fleet so the console shows
    // the difference between "available" and "dispatchable".
    publicId: '88888888-8888-4888-8888-888888888888',
    registrationNumber: 'RESQ-ICU-003',
    type: 'ICU',
    serviceArea: 'North District',
    capabilities: ['ventilator', 'cardiac monitor', 'infusion pumps'],
    baseLatitude: 13.0354,
    baseLongitude: 77.5971,
  },
];

async function main(): Promise<void> {
  for (const seed of USERS) {
    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        publicId: seed.publicId,
        name: seed.name,
        phone: seed.phone,
        role: seed.role,
        passwordHash,
      },
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
      const verification = seed.identityVerification ?? 'UNVERIFIED';
      const profileData = {
        availability: seed.availability ?? 'OFF_DUTY',
        licenseVerification: verification,
        identityVerification: verification,
        verifiedAt: verification === 'VERIFIED' ? new Date() : null,
      };
      await prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: profileData,
        create: { userId: user.id, ...profileData },
      });
    }
  }

  for (const ambulance of AMBULANCES) {
    const crew = ambulance.crewEmail
      ? await prisma.user.findUnique({ where: { email: ambulance.crewEmail } })
      : null;

    await prisma.ambulance.upsert({
      where: { registrationNumber: ambulance.registrationNumber },
      update: {
        publicId: ambulance.publicId,
        type: ambulance.type,
        capabilities: JSON.stringify(ambulance.capabilities),
        serviceArea: ambulance.serviceArea,
        status: 'AVAILABLE',
        baseLatitude: ambulance.baseLatitude,
        baseLongitude: ambulance.baseLongitude,
        driverId: crew?.id ?? null,
      },
      create: {
        publicId: ambulance.publicId,
        registrationNumber: ambulance.registrationNumber,
        type: ambulance.type,
        capabilities: JSON.stringify(ambulance.capabilities),
        serviceArea: ambulance.serviceArea,
        status: 'AVAILABLE',
        baseLatitude: ambulance.baseLatitude,
        baseLongitude: ambulance.baseLongitude,
        driverId: crew?.id ?? null,
      },
    });
  }

  const staffedCount = AMBULANCES.filter((ambulance) => ambulance.crewEmail).length;
  console.log(
    `Seed complete: ${USERS.length} users, ${AMBULANCES.length} ambulances (${staffedCount} with a crew).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
