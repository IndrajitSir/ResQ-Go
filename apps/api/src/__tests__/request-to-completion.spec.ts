import '../env';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { API_V1_PREFIX } from '@abs/config';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalHttpExceptionFilter } from '../common/filters/http-exception.filter';

/** Nest's global prefix has no leading slash; request paths need one. */
const BASE = `/${API_V1_PREFIX}`;

/**
 * End-to-end coverage of the core operational flow, exercised through the real
 * HTTP stack and the real database:
 *
 *   one-tap emergency request -> dispatch assignment -> crew accept ->
 *   en route -> arrival -> on board -> in transit -> completed
 *
 * It also pins the guards that protect the flow: a vehicle without a crew can
 * never be dispatched, a booking can only be dispatched once, and only the
 * people involved may read a booking.
 */
describe('Request to completion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;  const suffix = randomUUID().slice(0, 8);
  const created = {
    userIds: [] as string[],
    ambulanceIds: [] as string[],
    bookingIds: [] as string[],
  };
  // Per-test bookkeeping so each scenario leaves the database as it found it.
  const testBookings = new Set<string>();
  const tokens: { patient?: string; otherPatient?: string; dispatcher?: string; driver?: string; driver2?: string } = {};
  const fleet: { blsOne?: string; blsTwo?: string; unstaffed?: string } = {};

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/auth/login`)
      .send({ email, password })
      .expect(200);
    return response.body.data.accessToken as string;
  }

  beforeEach(() => {
    testBookings.clear();
  });

  afterEach(async () => {
    if (testBookings.size === 0) {
      return;
    }
    const ids = [...testBookings];
    // Remove all traces of this test's bookings so the next scenario starts
    // from a clean state. TripLocations are cascade-deleted by Prisma when the
    // parent trip disappears.
    await prisma.$transaction([
      prisma.tripLocation.deleteMany({ where: { trip: { booking: { publicId: { in: ids } } } } }),
      prisma.trip.deleteMany({ where: { booking: { publicId: { in: ids } } } }),
      prisma.bookingEvent.deleteMany({ where: { booking: { publicId: { in: ids } } } }),
      prisma.booking.deleteMany({ where: { publicId: { in: ids } } }),
    ]);
    // Return any vehicle or crew still locked by this test's trips back to
    // the available pool. Ambulance statuses during a trip are ON_TRIP (right
    // after dispatch assignment) and ASSIGNED (after the crew accepts); crew
    // availability tracks the same lifecycle.
    await prisma.ambulance.updateMany({
      where: { status: { in: ['ON_TRIP', 'ASSIGNED'] } },
      data: { status: 'AVAILABLE' },
    });
    await prisma.driverProfile.updateMany({
      where: { availability: { in: ['ON_TRIP', 'ASSIGNED'] } },
      data: { availability: 'AVAILABLE' },
    });
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_V1_PREFIX);
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
    // Bind an ephemeral IPv4 port so the HTTP stack (guards, filters, pipes)
    // is exercised for real. IPv4 is explicit because an IPv6 wildcard address
    // is not a valid URL host for the test client.
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash('Test#Password1', 10);

    const makeUser = async (name: string, role: string) => {
      const user = await prisma.user.create({
        data: {
          publicId: randomUUID(),
          name,
          email: `${name.toLowerCase().replace(/[^a-z]/g, '')}-${suffix}@example.com`,
          phone: '+15550000000',
          passwordHash,
          role,
          status: 'ACTIVE',
        },
      });
      created.userIds.push(user.id);
      return user;
    };

    const makeDriver = async (name: string) => {
      const user = await makeUser(name, 'DRIVER');
      await prisma.driverProfile.create({
        data: {
          userId: user.id,
          availability: 'AVAILABLE',
          identityVerification: 'VERIFIED',
          licenseVerification: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });
      return user;
    };

    const makeAmbulance = async (registrationNumber: string, driverId?: string) => {
      const ambulance = await prisma.ambulance.create({
        data: {
          publicId: randomUUID(),
          registrationNumber,
          type: 'BLS',
          capabilities: JSON.stringify(['oxygen']),
          serviceArea: 'Test District',
          status: 'AVAILABLE',
          baseLatitude: 12.97,
          baseLongitude: 77.59,
          driverId: driverId ?? null,
        },
      });
      created.ambulanceIds.push(ambulance.id);
      return ambulance;
    };

    const patient = await makeUser('Fleet Patient', 'PATIENT');
    const otherPatient = await makeUser('Other Patient', 'PATIENT');
    await makeUser('Fleet Dispatcher', 'DISPATCHER');
    const driverOne = await makeDriver('Fleet Driver One');
    const driverTwo = await makeDriver('Fleet Driver Two');
    await makeDriver('Fleet Driver Unstaffed');

    const blsOne = await makeAmbulance(`E2E-BLS-1-${suffix}`, driverOne.id);
    const blsTwo = await makeAmbulance(`E2E-BLS-2-${suffix}`, driverTwo.id);
    const unstaffed = await makeAmbulance(`E2E-BLS-3-${suffix}`);
    fleet.blsOne = blsOne.publicId;
    fleet.blsTwo = blsTwo.publicId;
    fleet.unstaffed = unstaffed.publicId;

    tokens.patient = await login(patient.email, 'Test#Password1');
    tokens.otherPatient = await login(otherPatient.email, 'Test#Password1');
    tokens.dispatcher = await login(`fleetdispatcher-${suffix}@example.com`, 'Test#Password1');
    tokens.driver = await login(driverOne.email, 'Test#Password1');
    tokens.driver2 = await login(driverTwo.email, 'Test#Password1');
  });

  afterAll(async () => {
    // afterEach already cleaned up per-test data. Remove the seed data and
    // close the app. If a prior test run left orphaned rows in this database
    // file, broad deletes are safer than targeted ones.
    await prisma.tripLocation.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.bookingEvent.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.ambulance.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.auditLog.deleteMany();
    await app.close();
  });

  async function createEmergencyRequest(): Promise<{ publicId: string; token: string }> {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/bookings`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({
        idempotencyKey: randomUUID(),
        // One tap shares coordinates only: no addresses, no receiving facility.
        pickup: { latitude: 12.9716, longitude: 77.5946 },
        requiredAmbulanceType: 'BLS',
        urgency: 'EMERGENCY',
      })
      .expect(201);
    const publicId = response.body.data.publicId as string;
    created.bookingIds.push(publicId);
    testBookings.add(publicId);
    return { publicId, token: tokens.patient! };
  }

  it('accepts a one-tap emergency request that only shares coordinates', async () => {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/bookings`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({
        idempotencyKey: randomUUID(),
        pickup: { latitude: 12.9802, longitude: 77.6001 },
        requiredAmbulanceType: 'BLS',
        urgency: 'EMERGENCY',
      })
      .expect(201);

    const publicId = response.body.data.publicId as string;
    created.bookingIds.push(publicId);
    testBookings.add(publicId);

    expect(response.body.data).toMatchObject({
      status: 'REQUESTED',
      urgency: 'EMERGENCY',
      destinationPending: true,
    });
    // Honest placeholders: dispatch sees the request immediately and confirms
    // the receiving facility while a crew is already moving.
    expect(response.body.data.pickup.label).toBe('Device location');
    expect(response.body.data.destination.label).toContain('to be confirmed');
  });

  it('rejects a non-emergency request without a destination', async () => {
    const response = await request(app.getHttpServer())
      .post(`${BASE}/bookings`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({
        idempotencyKey: randomUUID(),
        pickup: { latitude: 12.9, longitude: 77.5 },
        requiredAmbulanceType: 'BLS',
        urgency: 'URGENT',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fieldErrors).toHaveProperty('pickup');
    // No booking was created; nothing to clean up.
  });

  it('runs the full lifecycle with crew visibility, live position, and ETA', async () => {
    const { publicId } = await createEmergencyRequest();

    // Dispatch sees the emergency in the queue.
    const queue = await request(app.getHttpServer())
      .get(`${BASE}/dispatch/queue`)
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .expect(200);
    expect(queue.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ publicId, urgency: 'EMERGENCY' })]),
    );

    // Eligible vehicles are staffed and ranked by distance from the patient.
    const eligible = await request(app.getHttpServer())
      .get(`${BASE}/dispatch/eligible`)
      .query({ bookingPublicId: publicId })
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .expect(200);
    const eligibleIds = (eligible.body.data as Array<{ publicId: string }>).map((a) => a.publicId);
    expect(eligibleIds).toContain(fleet.blsOne);
    const distances = (eligible.body.data as Array<{ distanceKm?: number }>).map((a) => a.distanceKm ?? -1);
    expect(distances.every((value) => value >= 0)).toBe(true);

    // A vehicle without a crew must never be dispatched.
    const noCrew = await request(app.getHttpServer())
      .post(`${BASE}/dispatch/bookings/${publicId}/assign`)
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .send({ ambulanceId: fleet.unstaffed })
      .expect(409);
    expect(noCrew.body.error.message).toMatch(/no crew/i);

    const assigned = await request(app.getHttpServer())
      .post(`${BASE}/dispatch/bookings/${publicId}/assign`)
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .send({ ambulanceId: fleet.blsOne })
      .expect(201);
    const tripPublicId = assigned.body.data.trip.publicId as string;
    expect(assigned.body.data.booking.status).toBe('ASSIGNED');

    // The crew sees the vehicle they were given.
    const mine = await request(app.getHttpServer())
      .get(`${BASE}/trips/mine`)
      .set('Authorization', `Bearer ${tokens.driver}`)
      .expect(200);
    expect(mine.body.data[0].vehicle.registrationNumber).toBe(`E2E-BLS-1-${suffix}`);

    await request(app.getHttpServer())
      .post(`${BASE}/trips/${tripPublicId}/decision`)
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({ decision: 'ACCEPTED' })
      .expect(201);

    for (const status of ['DRIVER_EN_ROUTE', 'ARRIVED', 'PATIENT_ONBOARD', 'IN_TRANSIT']) {
      const updated = await request(app.getHttpServer())
        .post(`${BASE}/trips/${tripPublicId}/status`)
        .set('Authorization', `Bearer ${tokens.driver}`)
        .send({ status })
        .expect(201);
      expect(updated.body.data.booking.status).toBe(status);
    }

    // Driver telemetry: the requester must be able to reach the crew.
    const ping = await request(app.getHttpServer())
      .post(`${BASE}/trips/${tripPublicId}/location`)
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({ latitude: 12.9401, longitude: 77.6101, heading: 180, speedKph: 42 })
      .expect(201);
    expect(ping.body.data.etaMinutes).toBeGreaterThan(0);

    const detail = await request(app.getHttpServer())
      .get(`${BASE}/bookings/${publicId}`)
      .set('Authorization', `Bearer ${tokens.patient}`)
      .expect(200);
    expect(detail.body.data.crew).toMatchObject({
      driverName: 'Fleet Driver One',
      driverPhone: '+15550000000',
      ambulanceRegistrationNumber: `E2E-BLS-1-${suffix}`,
    });
    expect(detail.body.data.liveLocation.latitude).toBeCloseTo(12.9401);
    expect(detail.body.data.distanceRemainingKm).toBeGreaterThan(0);
    expect(detail.body.data.etaMinutes).toBeGreaterThan(0);

    const completed = await request(app.getHttpServer())
      .post(`${BASE}/trips/${tripPublicId}/status`)
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({ status: 'COMPLETED' })
      .expect(201);
    expect(completed.body.data.booking.status).toBe('COMPLETED');

    // The vehicle and its crew return to the available pool.
    const ambulance = await prisma.ambulance.findUniqueOrThrow({ where: { publicId: fleet.blsOne! } });
    expect(ambulance.status).toBe('AVAILABLE');
    const profile = await prisma.driverProfile.findFirstOrThrow({
      where: { user: { publicId: (await prisma.user.findFirstOrThrow({ where: { name: 'Fleet Driver One' } })).publicId } },
    });
    expect(profile.availability).toBe('AVAILABLE');
  });

  it('dispatches a request exactly once when two consoles race for it', async () => {
    const { publicId } = await createEmergencyRequest();

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`${BASE}/dispatch/bookings/${publicId}/assign`)
        .set('Authorization', `Bearer ${tokens.dispatcher}`)
        .send({ ambulanceId: fleet.blsOne }),
      request(app.getHttpServer())
        .post(`${BASE}/dispatch/bookings/${publicId}/assign`)
        .set('Authorization', `Bearer ${tokens.dispatcher}`)
        .send({ ambulanceId: fleet.blsTwo }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const conflict = [first, second].find((response) => response.status === 409)!;
    expect(conflict.body.error.code).toBe('CONFLICT');

    const trips = await prisma.trip.count({
      where: { booking: { publicId } },
    });
    expect(trips).toBe(1);
  });

  it('lets dispatch confirm the receiving facility after an emergency request', async () => {
    const { publicId } = await createEmergencyRequest();

    const updated = await request(app.getHttpServer())
      .post(`${BASE}/bookings/${publicId}/destination`)
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .send({
        destination: {
          label: 'City General Hospital',
          address: '5 Hospital Road',
          latitude: 12.9352,
          longitude: 77.6245,
        },
      })
      .expect(200);

    // Destination confirmed: the field is omitted rather than exposed as false.
    expect(updated.body.data.destinationPending).toBeUndefined();
    expect(updated.body.data.destination.label).toBe('City General Hospital');
  });

  it('keeps a booking private to the people involved', async () => {
    const { publicId } = await createEmergencyRequest();

    await request(app.getHttpServer())
      .get(`${BASE}/bookings/${publicId}`)
      .set('Authorization', `Bearer ${tokens.otherPatient}`)
      .expect(404);
  });

  it('rejects location pings from someone who is not the assigned crew', async () => {
    const { publicId } = await createEmergencyRequest();
    const assigned = await request(app.getHttpServer())
      .post(`${BASE}/dispatch/bookings/${publicId}/assign`)
      .set('Authorization', `Bearer ${tokens.dispatcher}`)
      .send({ ambulanceId: fleet.blsOne })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${BASE}/trips/${assigned.body.data.trip.publicId}/location`)
      .set('Authorization', `Bearer ${tokens.driver2}`)
      .send({ latitude: 12.9, longitude: 77.5 })
      .expect(403);
  });
});
