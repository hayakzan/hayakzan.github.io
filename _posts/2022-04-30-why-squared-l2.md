# Why squared $$L^2$$ norm over $$L^2$$ norm?

In the Linear Algebra chapter of Goodfellow et al.'s brilliant [Deep Learning book](https://www.deeplearningbook.org/contents/linear_algebra.html), the following statement appears:

> The squared $$L^2$$ norm is more convenient to work with mathematically and computationally than the $$L^2$$ norm itself. For example, each derivative of the squared $$L^2$$ norm with respect to each element of $$\textbf{x}$$ depends only on the corresponding element of $$\textbf{x}$$, while all the derivatives of $$L^2$$ depend on the entire vector.

I wasn't quite sure about what is exactly referred here, so needed to dig in a bit. Hope this helps to some other learner looking for the same thing. 

The Euclidean norm, or $$L^2$$ norm can be expressed as follows:

<img width="629" alt="Screen Shot 2022-04-30 at 2 29 35 PM" src="https://user-images.githubusercontent.com/61164329/166123310-36dedcfc-7b62-4f22-b194-30957d57b031.png">

The derivative of it indeed depends on the entire vector, like this:

<img width="874" alt="Screen Shot 2022-04-30 at 2 29 06 PM" src="https://user-images.githubusercontent.com/61164329/166123322-bced7431-1d1c-42c9-b812-3de1caab1507.png">

Whereas for $$(L^2)^2$$,

<img width="1209" alt="Screen Shot 2022-04-30 at 2 53 37 PM" src="https://user-images.githubusercontent.com/61164329/166123881-b0c6b4d3-e5de-4a85-bb46-bb5cadd0357a.png">

the derivative conveniently depends on $$x_i^2$$, resulting in: 

<img width="568" alt="Screen Shot 2022-04-30 at 3 28 08 PM" src="https://user-images.githubusercontent.com/61164329/166124640-4cda227b-1f29-4d20-ac30-cb35b5c62212.png">




__________________________






<img width="722" alt="derivative" src="https://user-images.githubusercontent.com/61164329/166124823-05a2cd79-d155-4b44-835b-aa1f4100832e.png">


