# Embedded Language Test Document

This document tests the Phase 1 embedded language aggregation feature.

## TypeScript Example

Below is a TypeScript interface and implementation:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

function createUser(name: string, email: string): User {
  return {
    id: Math.floor(Math.random() * 1000),
    name,
    email,
    isActive: true
  };
}

// Test completion: type 'user.' after the dot
const user = createUser("Alice", "alice@example.com");

// Test hover: hover over 'User' type annotation
const displayName = (u: User): string => {
  return `${u.name} (${u.email})`;
};
```

**Testing instructions:**
- Place cursor after `user.` and trigger completion (Ctrl+Space) → should show TypeScript properties (id, name, email, isActive)
- Hover over `User` type → should show interface definition
- Hover over `createUser` → should show function signature

## Python Example

Here's a Python class with type hints:

```python
from typing import List, Optional

class Calculator:
    """A simple calculator class."""
    
    def __init__(self):
        self.history: List[float] = []
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers and return the result."""
        result = a + b
        self.history.append(result)
        return result
    
    def get_average(self) -> Optional[float]:
        """Calculate the average of all results in history."""
        if not self.history:
            return None
        return sum(self.history) / len(self.history)

# Test completion: type 'calc.' after the dot
calc = Calculator()
result = calc.add(10, 20)

# Test hover: hover over 'Calculator' class name
```

**Testing instructions:**
- Place cursor after `calc.` and trigger completion → should show Python methods (add, get_average, history)
- Hover over `Calculator` → should show class docstring
- Hover over `add` method → should show method signature and docstring

## JavaScript Example

Simple JavaScript with JSDoc:

```javascript
/**
 * Formats a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code (e.g., 'USD')
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

// Test completion: type after the dot
const price = 99.99;
const formatted = formatCurrency(price, 'EUR');
```

**Testing instructions:**
- Hover over `formatCurrency` → should show JSDoc documentation
- Type `price.` → should show number methods (toFixed, toString, etc.)

## Rust Example

Rust code with explicit types:

```rust
#[derive(Debug)]
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
    
    fn distance_from_origin(&self) -> f64 {
        (self.x.powi(2) + self.y.powi(2)).sqrt()
    }
}

// Test: hover over Point type
fn main() {
    let p = Point::new(3.0, 4.0);
    println!("Distance: {}", p.distance_from_origin());
}
```

**Testing instructions:**
- Hover over `Point` → should show struct definition
- Type `p.` → should show struct fields and methods
- Hover over `distance_from_origin` → should show method signature

## Mixed Content Test

Regular Markdown content with inline code `let x = 42;` should use host hover.

### Section Header

Some regular text outside fences.

```go
package main

import "fmt"

func main() {
    message := "Hello from Go!"
    fmt.Println(message)
}
```

**Note:** Go support requires `gopls` to be installed.

## Edge Cases

### Empty Fence

```typescript
```

### Unsupported Language

```imaginary-lang
This should gracefully skip with log message
```

### Multiple Fences Same Language

First TypeScript fence:
```typescript
const x: number = 42;
```

Second TypeScript fence (should reuse same server):
```typescript
const y: string = "hello";
```

## Verification Checklist

- [ ] TypeScript completion works inside fence
- [ ] Python hover works inside fence
- [ ] JavaScript/TypeScript alias resolution
- [ ] Rust completion (if rust-analyzer installed)
- [ ] Host Markdown completions work outside fences
- [ ] Host Markdown hover works outside fences
- [ ] Multiple fences reuse same server
- [ ] Unsupported languages logged but don't crash
- [ ] Empty fences don't cause errors
- [ ] Server shutdown clean on document close

## Debug Log Analysis

Check for these log patterns:

```
[EMBED] detected fence lang=typescript lines=X-Y
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] initialized lang=typescript capabilities=[...]
[EMBED] didOpen lang=typescript uri=embedded://... version=1
[EMBED] forward completion lang=typescript pos=X:Y
[EMBED] completion result lang=typescript count=N
```

Expected behavior:
- First TypeScript fence triggers spawn
- Second TypeScript fence reuses existing server
- Unsupported languages: `[EMBED] skip lang=X: unsupported/no backend`
