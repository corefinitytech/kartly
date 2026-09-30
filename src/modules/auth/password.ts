const COMMON_PASSWORDS = new Set([
  "123456","password","123456789","12345678","12345","qwerty","1234567","111111","1234567890","123123",
  "abc123","1234","password1","iloveyou","000000","qwerty123","zaq12wsx","dragon","sunshine","princess",
  "letmein","654321","monkey","27653","1qaz2wsx","123321","qwertyuiop","superman","asdfghjkl","trustno1",
  "batman","passw0rd","football","shadow","master","666666","qwertyasdf","michael","minecraft","login",
  "welcome","admin","hello","freedom","whatever","qazwsx","trustme","batman1","soccer","harley",
  "password123","killer","george","asdf","computer","michelle","jessica","pepper","1111","zxcvbn",
  "555555","11111111","131313","freedom1","magic","zaq1zaq1","asdfasdf","monkey1","dragon1","naruto",
  "password2","summer","charlie","jordan23","iloveyou1","jennifer","hunter","love","buster","soccer1",
  "thomas","robert","hockey","ranger","daniel","starwars","klaster","112233","asdf1234","anthony",
  "jessica1","aaaaaa","123qwe","matrix","silver","william","panties","love123","secret","123abc",
  "justin","lovely","snoopy","tigger","purple","ginger","banana","chicken","maggie","fender",
  "purple1","ginger1","banana1","chicken1","morgan","nicole","hannah","aaaa1111","test","test123",
  "pokemon","samsung","google","liverpool","chelsea","arsenal","manchester","barcelona","realmadrid","juventus",
  "letmein1","welcome1","welcome123","admin123","admin1","root","toor","pass","pass123","pass1234",
  "abcd1234","qwe123","1q2w3e4r","q1w2e3r4","1234qwer","internet","samsung1","google1","amazon","netflix",
  "flowers","cookie","babygirl","lover","lovely1","angel","dallas","jayjay","loveyou","family",
  "cheese","jackson","peanut","summer1","ashley","bailey","passion","nicole1","chocolate","sophie",
  "kitten","accessible","marina","friend","lauren","tigger1","joshua","amanda","loveyou1","dog",
  "111111111","222222","88888888","159753","taylor","bubbles","chris1","sexy","69number","654321a",
  "mot de passe","qwerty1","azerty","querty","putin","1a2b3c","football1","yankees","redsox","steelers",
  "gideons","champs","baseball","bleach","scooby","phoenix","pussy","fuckyou","6969","121212",
  "654321b","happy","elephant","panther","cougar","corvette","mercedes","ferrari","porsche","lamborghini",
  "mustang","camaro","harley1","yankees1","ranger1","tiger","cougars","browns","packers","celtics",
  "warrior","dragonball","sakura","naruto1","sasuke","kakashi","pokemon1","pikachu","charizard","snorlax",
]);

export interface PasswordIssue {
  field: "password";
  message: string;
}

export function validatePassword(
  password: string,
  email?: string,
): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < 10 || password.length > 128) {
    issues.push({ field: "password", message: "Password must be between 10 and 128 characters." });
    return issues;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    issues.push({ field: "password", message: "This password is too common. Choose something less obvious." });
  }
  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    issues.push({ field: "password", message: "Password must not contain your email address." });
  }
  return issues;
}

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function passwordStrength(password: string): Strength {
  if (password.length === 0) return { score: 0, label: "Enter a password" };
  let points = 0;
  if (password.length >= 10) points += 1;
  if (password.length >= 14) points += 1;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (variety >= 3) points += 1;
  if (variety >= 4) points += 1;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) points = Math.min(points, 1);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;
  const score = Math.min(4, points) as Strength["score"];
  return { score, label: labels[score]! };
}
