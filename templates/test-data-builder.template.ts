/**
 * Test Data Builder Template
 * 
 * This pattern helps create test data with sensible defaults
 * while allowing customization for specific test scenarios.
 */

export class [EntityName]TestDataBuilder {
  private data: Partial<[EntityType]>;

  constructor() {
    // Set default valid data
    this.data = {
      id: this.generateId(),
      name: 'Test [Entity]',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      // ... other default fields with valid values
    };
  }

  // ID generators
  private generateId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEmail(): string {
    const timestamp = Date.now();
    return `test.user.${timestamp}@example.com`;
  }

  // Basic builder methods
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withStatus(status: [StatusType]): this {
    this.data.status = status;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  withCustomData(data: Partial<[EntityType]>): this {
    this.data = { ...this.data, ...data };
    return this;
  }

  // Preset builders for common scenarios
  asNew(): this {
    delete this.data.id;
    delete this.data.createdAt;
    delete this.data.updatedAt;
    return this;
  }

  asInvalid(): this {
    this.data = {
      ...this.data,
      name: '', // Empty required field
      status: 'invalid_status' as any, // Invalid enum value
      // ... other invalid fields
    };
    return this;
  }

  asExpired(): this {
    this.data = {
      ...this.data,
      status: 'expired',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // yesterday
    };
    return this;
  }

  asDeleted(): this {
    this.data = {
      ...this.data,
      status: 'deleted',
      deletedAt: new Date()
    };
    return this;
  }

  asDraft(): this {
    this.data = {
      ...this.data,
      status: 'draft',
      publishedAt: null
    };
    return this;
  }

  asPublished(): this {
    this.data = {
      ...this.data,
      status: 'published',
      publishedAt: new Date()
    };
    return this;
  }

  // Relationship builders
  withRelatedEntity(entity: [RelatedEntityType]): this {
    this.data.relatedEntityId = entity.id;
    this.data.relatedEntity = entity;
    return this;
  }

  withRelatedEntities(entities: [RelatedEntityType][]): this {
    this.data.relatedEntities = entities;
    return this;
  }

  // Complex state builders
  withMinimalData(): this {
    // Keep only required fields
    const minimalData: Partial<[EntityType]> = {
      name: this.data.name,
      // ... other required fields only
    };
    this.data = minimalData;
    return this;
  }

  withMaximalData(): this {
    // Fill all optional fields
    this.data = {
      ...this.data,
      description: 'Detailed description for testing',
      metadata: {
        key1: 'value1',
        key2: 'value2'
      },
      tags: ['tag1', 'tag2', 'tag3'],
      // ... all optional fields
    };
    return this;
  }

  // Build methods
  build(): [EntityType] {
    // Validate required fields
    if (!this.data.name) {
      throw new Error('[EntityName] requires a name');
    }
    
    return this.data as [EntityType];
  }

  buildPartial(): Partial<[EntityType]> {
    return this.data;
  }

  buildMany(count: number, customizer?: (builder: [EntityName]TestDataBuilder, index: number) => void): [EntityType][] {
    const results: [EntityType][] = [];
    
    for (let i = 0; i < count; i++) {
      const builder = new [EntityName]TestDataBuilder();
      
      // Copy current state
      builder.data = { ...this.data };
      
      // Apply index-based modifications
      builder.withId(`${this.data.id}-${i}`);
      builder.withName(`${this.data.name} ${i + 1}`);
      
      // Apply custom modifications
      if (customizer) {
        customizer(builder, i);
      }
      
      results.push(builder.build());
    }
    
    return results;
  }

  // Static factory methods for common scenarios
  static valid(): [EntityName]TestDataBuilder {
    return new [EntityName]TestDataBuilder();
  }

  static invalid(): [EntityName]TestDataBuilder {
    return new [EntityName]TestDataBuilder().asInvalid();
  }

  static expired(): [EntityName]TestDataBuilder {
    return new [EntityName]TestDataBuilder().asExpired();
  }

  static withStatus(status: [StatusType]): [EntityName]TestDataBuilder {
    return new [EntityName]TestDataBuilder().withStatus(status);
  }

  // Random data generators
  static random(): [EntityName]TestDataBuilder {
    const builder = new [EntityName]TestDataBuilder();
    const randomIndex = Math.floor(Math.random() * 1000);
    
    return builder
      .withName(`Random [Entity] ${randomIndex}`)
      .withCustomData({
        randomField: Math.random().toString(36)
      });
  }
}

// Usage Examples:
/*
// Basic usage
const entity = new [EntityName]TestDataBuilder().build();

// With customization
const customEntity = new [EntityName]TestDataBuilder()
  .withName('Custom Name')
  .withStatus('pending')
  .build();

// Invalid entity for error testing
const invalidEntity = [EntityName]TestDataBuilder.invalid().build();

// Multiple entities
const entities = new [EntityName]TestDataBuilder()
  .buildMany(5, (builder, index) => {
    if (index % 2 === 0) {
      builder.withStatus('inactive');
    }
  });

// Chained for specific scenario
const expiredDraftEntity = new [EntityName]TestDataBuilder()
  .asDraft()
  .asExpired()
  .withName('Old Draft')
  .build();
*/