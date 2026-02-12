import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin account
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
    },
  });
  console.log('Created admin account:', admin.username);

  // Create sample categories
  const billing = await prisma.category.upsert({
    where: { name: 'Billing' },
    update: {},
    create: {
      name: 'Billing',
      description: 'Billing and payment concerns',
      subCategories: {
        create: [
          { name: 'Payment' },
          { name: 'Refund' },
          { name: 'Invoice' },
        ],
      },
    },
    include: { subCategories: true },
  });
  console.log('Created category:', billing.name);

  const enrollment = await prisma.category.upsert({
    where: { name: 'Enrollment' },
    update: {},
    create: {
      name: 'Enrollment',
      description: 'Student enrollment services',
      subCategories: {
        create: [
          { name: 'New Enrollment' },
          { name: 'Re-enrollment' },
          { name: 'Transfer' },
        ],
      },
    },
    include: { subCategories: true },
  });
  console.log('Created category:', enrollment.name);

  const records = await prisma.category.upsert({
    where: { name: 'Records' },
    update: {},
    create: {
      name: 'Records',
      description: 'Academic records and documents',
      subCategories: {
        create: [
          { name: 'Transcript' },
          { name: 'Diploma' },
          { name: 'Certificate' },
        ],
      },
    },
    include: { subCategories: true },
  });
  console.log('Created category:', records.name);

  // Create sample windows
  const window1 = await prisma.window.upsert({
    where: { label: 'Window 1' },
    update: {},
    create: {
      label: 'Window 1',
      isActive: true,
    },
  });
  console.log('Created window:', window1.label);

  const window2 = await prisma.window.upsert({
    where: { label: 'Window 2' },
    update: {},
    create: {
      label: 'Window 2',
      isActive: true,
    },
  });
  console.log('Created window:', window2.label);

  // Create sample staff
  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.staff.upsert({
    where: { username: 'staff1' },
    update: {},
    create: {
      username: 'staff1',
      password: staffPassword,
      name: 'John Doe',
      isActive: true,
      specializations: {
        create: [
          { categoryId: billing.id },
          { categoryId: enrollment.id },
        ],
      },
    },
    include: { specializations: { include: { category: true } } },
  });
  console.log('Created staff:', staff.name);

  console.log('\n✅ Seeding completed!');
  console.log('\nDefault credentials:');
  console.log('Admin: username=admin, password=admin123');
  console.log('Staff: username=staff1, password=staff123');
  console.log('\n⚠️  Please change these passwords after first login!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
